# Copyright (c) 2022, Frappe Technologies Pvt. Ltd. and Contributors
# GNU GPLv3 License. See license.txt

import frappe
from frappe.utils.data import get_url


def get_or_create_session_key(email):
    session_key = frappe.db.get_value("Support Session", {"email": email}, "key")
    if not session_key:
        session_key = frappe.utils.generate_hash()
        session_doc = frappe.new_doc("Support Session")
        session_doc.email = email
        session_doc.key = session_key
        session_doc.insert(ignore_permissions=True)
    return session_key


def send_session_key_email(email, session_key, for_agent=False):
    if not frappe.conf.get("developer_mode"):
        base_url = "/support/portal/agent" if for_agent else "/support/portal/customer"
        link = get_url(f"""{base_url}?key={session_key}""")
        frappe.sendmail(
            recipients=[email],
            subject="Frappe Support: Verify your email",
            message=f"""<h3>Welcome to Frappe Support!</h3>
            <p>Please click on the link below to start your support session</p>
            <p><a href="{link}">Start your support session</a></p>
            """,
            now=True,
        )


@frappe.whitelist(allow_guest=True)
def send_session_key(email):
    support_user_exists = frappe.db.exists("Supported Site User", {"email": email})
    if not support_user_exists:
        return False
    session_key = get_or_create_session_key(email)
    send_session_key_email(email, session_key)
    return True


@frappe.whitelist(allow_guest=True)
def validate_session_key(key, for_agent=False):
    session_user_email = frappe.db.get_value("Support Session", {"key": key}, "email")
    if not session_user_email:
        return False
    if for_agent:
        return frappe.db.get_value("Support Team Member", {"user": session_user_email}, "user")
    return frappe.db.get_value("Supported Site User", {"email": session_user_email}, "email")


@frappe.whitelist(allow_guest=True)
def delete_session_key(key):
    frappe.db.delete("Support Session", {"key": key})


@frappe.whitelist(allow_guest=True)
def validate_user(email, site):
    SupportedSite = frappe.qb.DocType("Supported Site")
    SupportedSiteUser = frappe.qb.DocType("Supported Site User")
    is_valid = (
        frappe.qb.from_(SupportedSite)
        .select(SupportedSite.name)
        .left_join(SupportedSiteUser)
        .on(SupportedSite.name == SupportedSiteUser.parent)
        .where((SupportedSiteUser.email == email) & (SupportedSite.site_name == site))
        .run(pluck=True)
    )
    return is_valid


@frappe.whitelist(allow_guest=True)
def register_user(**kwargs):
    args = frappe._dict(kwargs)
    try:
        site_exists = frappe.db.exists("Supported Site", args.site)
        if site_exists:
            registered = auto_register_user(args)
            if registered:
                return

        frappe.session.user = "Administrator"

        issue = frappe.new_doc("Issue")
        issue.subject = "New Support Portal User Registration - " + args.email
        issue.source = "Partner Support Portal"
        issue.insert(ignore_permissions=True)

        content = f"""
        <p>You have a new registration from {args.email}<p>
        <p>User Name: {args.name}</p>
        <p>Company Name: {args.company}</p>
        <p>Site URL: {args.site}</p>
        <p>
        <br>
        To register the user follow these steps:<br>
        <ul>
        <li>Check if the Site <b>contains</b> the User ID and the user is an <b>Enabled System User</b>.</li>
        <li>If user not found or is an invalid user, reply to them accordingly.</li>
        <li>If user found, Create the <a style="text-decoration: underline;" href="https://frappe.io/app/support-profile">Support Profile</a> Entry for the Site URL, if Profile already exists, just add a new row with Email ID.</li>
        <li>While creating a <b>new</b> support profile entry, support plan expiry and user limit can be found in ERPNext Support User.</li>
        <li>A Contact will be auto created for the user. Check if there exists a contact associated with the User ID after saving the Profile.</li>
        <li>Once Contact and Profile is created, reply to the user email to update them that the verification process completed.</li>
        </ul>
        </p>"""

        communication = frappe.get_doc(
            dict(
                doctype="Communication",
                communication_type="Communication",
                communication_medium="Email",
                reference_doctype="Issue",
                reference_name=issue.name,
                sent_or_received="Received",
                sender=args.email,
                content=content,
                subject=issue.subject,
            )
        )
        communication.insert(ignore_permissions=True)
    except Exception:
        frappe.log_error()
        raise
    finally:
        frappe.session.user = "Guest"


def auto_register_user(args):
    # TODO: send a request to site_url with email and password to verify validity
    site = frappe.get_doc("Supported Site", args.site)
    site.append("support_users", {"email": args.email, "disabled": 0})
    site.save(ignore_permissions=True)
    key_sent = send_session_key(args.email)
    if not key_sent:
        return False
    frappe.msgprint(
        """A verification email has been sent to your email address.
        Please click on the link in the email to start your support session.""",
        title="Verification Email Sent",
    )
    return True


@frappe.whitelist(allow_guest=True)
def get_issues(**kwargs):
    args = frappe._dict(kwargs)
    print(args)
    email = get_user_email(args.key)
    site_list = get_site_list(email)

    if email:
        Issue = frappe.qb.DocType("Issue")

        open_or_close = args.open_or_close
        search_text = args.search_text

        if open_or_close == "Open" or open_or_close == "":
            status_condition = Issue.status != "Closed"
        elif open_or_close == "Close":
            status_condition = Issue.status == "Closed"
        else:
            status_condition = Issue.status.isnotnull()

        issue_condition = Issue.subject.isnotnull()
        if search_text:
            issue_condition = Issue.subject.like(
                f"%{search_text}%"
            ) | Issue.site_name.like(f"%{search_text}%")

        site_name_condition = []
        for d in site_list:
            site_name_condition.append(Issue.site_name.like(f"%{d}%"))

        issues = (
            frappe.qb.from_(Issue)
            .select(
                Issue.name,
                Issue.status,
                Issue.subject,
                Issue.creation,
                Issue.site_name,
            )
            .where(
                frappe.qb.terms.Criterion.all(
                    [
                        issue_condition,
                        status_condition,
                        frappe.qb.terms.Criterion.any(site_name_condition),
                    ]
                )
            )
            .orderby(Issue.creation, order=frappe.qb.desc)
            .run(as_dict=True)
        )

    return {
        "email": email,
        "issues": issues,
    }


def get_user_email(session_key):
    email = frappe.db.get_value("Support Session", {"key": session_key}, "email")
    if not email:
        frappe.throw(
            "Your support session has expired. Please login again to continue with Frappe Support.",
            title="Session Expired",
        )
    return email


def get_site_list(email):
    site_list = frappe.get_all(
        "Supported Site", {"email": email, "disabled": 0}, pluck="site_name"
    )
    if not site_list:
        frappe.throw(
            "You do not have access to any site. Please contact your system administrator.",
            title="No Access",
        )
    return site_list


@frappe.whitelist(allow_guest=True)
def get_site_options(key):
    email = get_user_email(key)
    site_list = get_site_list(email)
    return site_list


@frappe.whitelist(allow_guest=True)
def get_ticket(**kwargs):
    args = frappe._dict(kwargs)
    email = get_user_email(args.key)
    site_list = get_site_list(email)

    Issue = frappe.qb.DocType("Issue")
    issue = (
        frappe.qb.from_(Issue)
        .select(
            Issue.name,
            Issue.status,
            Issue.subject,
            Issue.resolution_by,
            Issue.raised_by,
            Issue.site_name,
        )
        .where((Issue.name == args.issue))  # add site_name condition
        .run(as_dict=True)
    )
    if not issue:
        frappe.throw(
            "You do not have access to this ticket. Please contact your system administrator.",
            title="No Access",
        )
    issue = issue[0]

    if issue.status in ("Replied", "Awaiting Reply"):
        issue.indicator = "yellow"
        issue.status = "Awaiting Reply"
    elif issue.status not in ("Closed"):
        issue.indicator = "orange"
        issue.status = "Open"
    else:
        issue.indicator = "green"
        issue.status = "Closed"

    issue.replies = get_replies(args.issue)
    return issue


@frappe.whitelist(allow_guest=True)
def create_issue(**kwargs):
    args = frappe._dict(kwargs)
    site_name = (args.sitename).replace("https://", "").split("/")[0]

    email = get_user_email(args.key)
    site_list = get_site_list(email)

    issue = frappe.get_doc(
        dict(
            doctype="Issue",
            subject=args.subject,
            raised_by=email,
            site_name=site_name,
            bench_site=site_name,
            account=site_name,
            raised_via_portal=1,
            source="Partner Support Portal",
            reference_document=args.ref_doc,
            reference_module=(args.ref_module).casefold(),
            reference_name=args.ref_name,
        )
    )
    issue.insert(ignore_permissions=True)

    communication = frappe.get_doc(
        dict(
            doctype="Communication",
            communication_type="Communication",
            communication_medium="Email",
            reference_doctype="Issue",
            reference_name=issue.name,
            sent_or_received="Received",
            sender=email,
            content=args.description,
            subject=args.subject,
        )
    )
    communication.insert(ignore_permissions=True)

    if not frappe.conf.developer_mode:
        email_sla_info(issue)
    return issue.name


def email_sla_info(issue):
    sla_url = "https://erpnext.com/support-sla"
    user_manual_url = "https://docs.erpnext.com/homepage"
    frappe.sendmail(
        recipients=[issue.raised_by],
        subject=f"Ticket ID {issue.name}",
        message=f"""
        Hello,<br>
        <br>
        We have received your ticket <strong>ID {issue.name}</strong> with subject: <strong>{issue.subject}</strong>.<br>
        <br>
        You can expect a response from us within one working day based on the criticality of the issue. Learn more by reading about our <a href="{sla_url}">Service Agreement</a>.<br>
        <br>
        You could also try finding your answer in the <a href="{user_manual_url}">User Manual</a>.<br>
        <br>
        <br>
        Note: For faster resolution and to avoid loss of communication, raise your concerns from Help >> ERPNext Support.<br>
        <br>
        ---<br>
        Best,<br>
        Team ERPNext<br>
        """,
        now=True,
    )


@frappe.whitelist(allow_guest=True)
def reply(**kwargs):
    args = frappe._dict(kwargs)
    email = get_user_email(args.key)
    site_list = get_site_list(email)

    content = frappe.parse_json(args.reply).get("content")
    old_user = frappe.session.user
    frappe.set_user("Administrator")
    communication = frappe.get_doc(
        dict(
            doctype="Communication",
            communication_type="Communication",
            communication_medium="Email",
            reference_doctype="Issue",
            reference_name=args.issue,
            sent_or_received="Received",
            sender=email,
            content=content,
            subject=args.subject,
        )
    )
    communication.insert(ignore_permissions=True)
    frappe.set_user(old_user)

    return get_replies(args.issue)


def get_replies(issue):
    replies = frappe.get_all(
        "Communication",
        fields=[
            "sender",
            "recipients",
            "sender_full_name",
            "content",
            "seen",
            "subject",
            "creation",
            "sent_or_received",
        ],
        filters={"reference_doctype": "Issue", "reference_name": issue},
        order_by="creation desc",
    )
    for c in replies:
        if c.sent_or_received == "Sent":
            c.sender_full_name = "Support Agent"
            c.content_bg_color = "bg-blue-50"
        else:
            c.content_bg_color = "bg-gray-100"
    return replies


@frappe.whitelist(allow_guest=True)
def close_issue(**kwargs):
    args = frappe._dict(kwargs)
    email = get_user_email(args.key)
    site_list = get_site_list(email)

    issue = frappe.get_doc("Issue", args.issue)
    if issue.site_name not in site_list:
        frappe.throw(
            "You do not have access to this ticket. Please contact your system administrator.",
            title="No Access",
        )

    if issue.raised_by != email:
        issue.closed_by = email
    issue.status = "Closed"
    issue.support_rating = args.support_rating
    issue.save(ignore_permissions=True)

    if args.content:
        issue.add_comment(text=args.content, comment_email=email)
