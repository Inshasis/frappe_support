# Copyright (c) 2022, Frappe Technologies Pvt. Ltd. and Contributors
# GNU GPLv3 License. See license.txt

import frappe
from frappe.core.doctype.communication.email import make as create_communication
from support.www.support.portal import (
    get_or_create_session_key,
    send_session_key_email,
    validate_session_key,
)

no_cache = 1


def get_context(context):
    pass


@frappe.whitelist(allow_guest=True)
def send_login_link(email):
    agent_exists = frappe.db.exists("Support Team Member", {"user": email})
    if not agent_exists:
        frappe.throw(
            "You have not been registered as an agent. Reach out to your administrator to get registered.",
            title="Not Registered",
        )

    session_key = get_or_create_session_key(email)
    send_session_key_email(email, session_key)


@frappe.whitelist(allow_guest=True)
def get_agent(session_key):
    email = validate_session_key(session_key)
    if not email:
        frappe.throw("Invalid Session Key")

    tickets = frappe.get_all(
        "Issue",
        fields=[
            "name",
            "subject",
            "status",
            "priority",
            "modified",
            "creation",
            "site_name",
        ],
        filters={"_assign": ["like", f'%"{email}"%']},
        order_by="creation desc",
    )

    return {"email": email, "tickets": tickets}


@frappe.whitelist(allow_guest=True)
def get_ticket(session_key, issue_name):
    email = validate_session_key(session_key)
    if not email:
        frappe.throw("Invalid Session Key")

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
        .where((Issue.name == issue_name) & (Issue._assign.like(f'%"{email}"%')))
        .run(as_dict=True)
    )
    if not issue:
        frappe.throw(
            "You do not have access to this ticket. Please contact your system administrator.",
            title="No Access",
        )
    issue = issue[0]
    issue.replies = get_replies(issue_name)
    return issue


def get_replies(issue_name):
    return frappe.get_all(
        "Communication",
        fields=[
            "name",
            "sender",
            "recipients",
            "sender_full_name",
            "content",
            "seen",
            "subject",
            "creation",
            "sent_or_received",
        ],
        filters={"reference_doctype": "Issue", "reference_name": issue_name},
        order_by="creation desc",
    )


@frappe.whitelist(allow_guest=True)
def reply_to_ticket(session_key, issue_name, content):
    email = validate_session_key(session_key)
    if not email:
        frappe.throw("Invalid Session Key")

    Issue = frappe.qb.DocType("Issue")
    issue = (
        frappe.qb.from_(Issue)
        .select(Issue.name)
        .where((Issue.name == issue_name) & (Issue._assign.like(f'%"{email}"%')))
        .run(as_dict=True)
    )
    if not issue:
        frappe.throw(
            "You do not have access to this ticket. Please contact your system administrator.",
            title="No Access",
        )

    issue = frappe.get_doc("Issue", issue_name)
    comm = create_communication(
        recipients=issue.raised_by,
        subject=f"Re: {issue.subject}",
        content=content,
        doctype="Issue",
        name=issue_name,
        sender=email,
        print_html="",
        send_me_a_copy=0,
        print_format="",
        attachments=[],
        read_receipt=0,
        print_letterhead=1,
        send_email=0 if frappe.conf.developer_mode else 1,
    )
    reply = frappe.db.get_value(
        "Communication",
        comm.get("name"),
        [
            "name",
            "sender",
            "recipients",
            "sender_full_name",
            "content",
            "seen",
            "subject",
            "creation",
            "sent_or_received",
        ],
        as_dict=True,
    )
    return reply
