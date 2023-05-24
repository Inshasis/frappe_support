# Copyright (c) 2022, Frappe Technologies Pvt. Ltd. and Contributors
# GNU GPLv3 License. See license.txt

import frappe
from frappe.core.doctype.communication.email import make as create_communication
from frappe.desk.form.assign_to import add as add_assign
from frappe.desk.form.assign_to import remove as remove_assign
from frappe.query_builder.functions import Count
from support.www.support.portal import (
    admin_session,
    delete_session_key,
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
            "You have not been registered as an agent. Please contact us on support@frappe.io",
            title="Not Registered",
        )

    session_key = get_or_create_session_key(email)
    send_session_key_email(email, session_key, for_agent=True)


@frappe.whitelist(allow_guest=True)
def get_agents(session_key):
    email = validate_session_key(session_key, for_agent=True)
    if not email:
        frappe.throw("Invalid Session Key")

    SupportProvider = frappe.qb.DocType("Support Provider")
    SupportProviderTeam = frappe.qb.DocType("Support Provider Team")
    SupportTeamMember = frappe.qb.DocType("Support Team Member")
    User = frappe.qb.DocType("User")

    support_provider_team = (
        frappe.qb.from_(SupportProvider)
        .inner_join(SupportProviderTeam)
        .on(SupportProvider.name == SupportProviderTeam.support_provider)
        .inner_join(SupportTeamMember)
        .on(SupportProviderTeam.name == SupportTeamMember.parent)
        .where(SupportTeamMember.user == email)
        .select(SupportProviderTeam.name.as_("team"))
        .run(as_dict=True)
    )
    agents = (
        frappe.qb.from_(SupportProvider)
        .inner_join(SupportProviderTeam)
        .on(SupportProvider.name == SupportProviderTeam.support_provider)
        .inner_join(SupportTeamMember)
        .on(SupportProviderTeam.name == SupportTeamMember.parent)
        .inner_join(User)
        .on(SupportTeamMember.user == User.name)
        .where(SupportProviderTeam.name == support_provider_team[0].team)
        .select(
            SupportProvider.name.as_("support_provider"),
            SupportProviderTeam.team_name.as_("team"),
            SupportTeamMember.user.as_("email"),
            SupportTeamMember.disabled,
            User.full_name,
        )
        .run(as_dict=True)
    )
    return agents


@frappe.whitelist(allow_guest=True)
def get_agent(session_key, agent_email=None, with_tickets=True):
    email = validate_session_key(session_key, for_agent=True)
    if not email:
        frappe.throw("Invalid Session Key")

    SupportProvider = frappe.qb.DocType("Support Provider")
    SupportProviderTeam = frappe.qb.DocType("Support Provider Team")
    SupportTeamMember = frappe.qb.DocType("Support Team Member")
    User = frappe.qb.DocType("User")

    agent = (
        frappe.qb.from_(SupportProvider)
        .inner_join(SupportProviderTeam)
        .on(SupportProvider.name == SupportProviderTeam.support_provider)
        .inner_join(SupportTeamMember)
        .on(SupportProviderTeam.name == SupportTeamMember.parent)
        .inner_join(User)
        .on(SupportTeamMember.user == User.name)
        .select(
            SupportProvider.name.as_("support_provider"),
            SupportProviderTeam.name.as_("team"),
            SupportProviderTeam.team_name.as_("team_name"),
            SupportTeamMember.user.as_("email"),
            SupportTeamMember.disabled,
            User.full_name,
        )
        .where(SupportTeamMember.user == (agent_email or email))
        .run(as_dict=True)
    )
    if not agent:
        frappe.throw(
            "You have not been registered as an agent. Reach out to your administrator to get registered.",
            title="Not Registered",
        )

    agent = agent[0]

    if not with_tickets:
        return agent

    agent.tickets = frappe.get_all(
        "Issue",
        fields=[
            "name",
            "subject",
            "status",
            "priority",
            "modified",
            "creation",
            "site_name",
            "_assign",
            "_comments",
        ],
        filters={"support_provider": agent.support_provider},
        order_by="creation desc",
    )
    return agent


@frappe.whitelist(allow_guest=True)
def add_agent(session_key, new_agent):
    agent = get_agent(session_key)

    new_agent = frappe.parse_json(new_agent)
    email = new_agent.get("email")
    if frappe.db.exists("Support Team Member", {"user": email, "parent": agent.team}):
        frappe.msgprint("Agent already exists.", alert=True)
        return

    new_user = frappe.get_doc(
        {
            "doctype": "User",
            "email": email,
            "first_name": new_agent.get("firstname"),
            "last_name": new_agent.get("lastname"),
            "send_welcome_email": 0,
            "user_type": "Website User",
        }
    )
    new_user.insert(ignore_permissions=True)

    agent_doc = frappe.get_doc("Support Provider Team", agent.team)
    agent_doc.append("members", {"user": email})
    agent_doc.save(ignore_permissions=True)

    return get_agent(session_key, email, with_tickets=False)


@frappe.whitelist(allow_guest=True)
def remove_agent(session_key, email):
    agent = get_agent(session_key)
    if agent.email == email:
        frappe.throw("You cannot remove yourself.")

    if not frappe.db.exists(
        "Support Team Member", {"user": email, "parent": agent.team}
    ):
        frappe.throw("Agent does not exist.")

    user = frappe.get_doc("User", email)
    with admin_session():
        user.remove_roles("Support Provider")
    agent_doc = frappe.get_doc("Support Provider Team", agent.team)
    for member in agent_doc.members:
        if member.user == email:
            agent_doc.remove(member)
            break
    agent_doc.save(ignore_permissions=True)


@frappe.whitelist(allow_guest=True)
def disable_agent(session_key, email):
    agent = get_agent(session_key)
    if agent.email == email:
        frappe.throw("You cannot disable yourself.")

    if not frappe.db.exists(
        "Support Team Member", {"user": email, "parent": agent.team}
    ):
        frappe.throw("Agent does not exist.")

    frappe.db.set_value(
        "Support Team Member", {"user": email, "parent": agent.team}, "disabled", 1
    )


@frappe.whitelist(allow_guest=True)
def get_ticket(session_key, issue_name):
    agent = get_agent(session_key)
    Issue = frappe.qb.DocType("Issue")
    issue = (
        frappe.qb.from_(Issue)
        .select(
            Issue.name,
            Issue.status,
            Issue.subject,
            Issue.response_by,
            Issue.first_responded_on,
            Issue.resolution_date.as_("resolution_on"),
            Issue.resolution_by,
            Issue.raised_by,
            Issue.site_name,
            Issue._assign,
        )
        .where(
            (Issue.name == issue_name)
            & (Issue.support_provider == agent.support_provider)
        )
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
def reply_to_ticket(session_key, issue_name, reply):
    agent = get_agent(session_key)
    Issue = frappe.qb.DocType("Issue")
    issue = (
        frappe.qb.from_(Issue)
        .select(Issue.name)
        .where(
            (Issue.name == issue_name)
            & (Issue.support_provider == agent.support_provider)
        )
        .run(as_dict=True)
    )
    if not issue:
        frappe.throw(
            "You do not have access to this ticket. Please contact your system administrator.",
            title="No Access",
        )

    # sending content inside an objecy to avoid sanitization
    content = frappe.parse_json(reply).get("content")
    issue = frappe.get_doc("Issue", issue_name)
    old_user = frappe.session.user
    frappe.set_user("Administrator")
    comm = create_communication(
        recipients=issue.raised_by,
        subject=f"Re: {issue.subject}",
        content=content,
        doctype="Issue",
        name=issue_name,
        sender=agent.email,
        print_html="",
        send_me_a_copy=0,
        print_format="",
        attachments=[],
        read_receipt=0,
        print_letterhead=1,
        send_email=0 if frappe.conf.developer_mode else 1,
    )
    frappe.set_user(old_user)
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


@frappe.whitelist(allow_guest=True)
def toggle_assignee(session_key, issue_name, assignee):
    agent = get_agent(session_key)
    Issue = frappe.qb.DocType("Issue")
    issue = (
        frappe.qb.from_(Issue)
        .select(Issue.name, Issue._assign, Issue.subject)
        .where(
            (Issue.name == issue_name)
            & (Issue.support_provider == agent.support_provider)
        )
        .run(as_dict=True)
    )
    if not issue:
        frappe.throw(
            "You do not have access to this ticket. Please contact your system administrator.",
            title="No Access",
        )

    issue = issue[0]
    assignees = issue.get("_assign") or []
    with admin_session():
        if assignee not in assignees:
            add_assign(
                {
                    "assign_to": [assignee],
                    "doctype": "Issue",
                    "name": issue_name,
                    "description": issue.subject,
                }
            )

        else:
            remove_assign("Issue", issue_name, assignee)

    return frappe.db.get_value("Issue", issue_name, "_assign")


@frappe.whitelist(allow_guest=True)
def set_status(session_key, issue_name, status):
    agent = get_agent(session_key)
    Issue = frappe.qb.DocType("Issue")
    issue = (
        frappe.qb.from_(Issue)
        .select(Issue.name)
        .where(
            (Issue.name == issue_name)
            & (Issue.support_provider == agent.support_provider)
        )
        .run(as_dict=True)
    )
    if not issue:
        frappe.throw(
            "You do not have access to this ticket. Please contact your system administrator.",
            title="No Access",
        )

    issue = frappe.get_doc("Issue", issue_name)
    issue.status = status
    with admin_session():
        issue.save(ignore_permissions=True)
    return issue.status


@frappe.whitelist(allow_guest=True)
def add_site(session_key, new_site):
    agent = get_agent(session_key)

    new_site = frappe.parse_json(new_site)
    site_name = new_site.get("site_name")
    if support_provider := frappe.db.get_value(
        "Supported Site", site_name, "support_provider"
    ):
        if support_provider != agent.support_provider:
            frappe.throw("Site already exists and is supported by another provider.")
        else:
            frappe.throw("Site already exists.")

    new_site = frappe.new_doc("Supported Site")
    new_site.site_name = site_name
    new_site.support_provider = agent.support_provider
    new_site.save(ignore_permissions=True)

    return get_site(session_key, site_name)


@frappe.whitelist(allow_guest=True)
def remove_site(session_key, site_name):
    agent = get_agent(session_key)
    site = get_site(session_key, site_name)
    if site.support_provider != agent.support_provider:
        frappe.throw("You do not have access to this site.")

    site = frappe.get_doc("Supported Site", site_name)
    site.support_provider = ""
    site.add_comment("Comment", "Site removed by support provider.")
    site.flags.ignore_mandatory = True
    site.save(ignore_permissions=True)


@frappe.whitelist(allow_guest=True)
def get_site(session_key, site_name):
    agent = get_agent(session_key)

    SupportedSite = frappe.qb.DocType("Supported Site")
    SupportedSiteUser = frappe.qb.DocType("Supported Site User")
    site = (
        frappe.qb.from_(SupportedSite)
        .select(
            SupportedSite.site_name,
            SupportedSite.support_provider,
            Count(SupportedSiteUser.name).as_("user_count"),
        )
        .left_join(SupportedSiteUser)
        .on(SupportedSiteUser.parent == SupportedSite.name)
        .where(
            (SupportedSite.site_name == site_name)
            & (SupportedSite.support_provider == agent.support_provider)
        )
        .groupby(SupportedSite.site_name)
        .run(as_dict=True)
    )
    if not site:
        frappe.throw("You do not have access to this site.")

    site = site[0]
    return site


@frappe.whitelist(allow_guest=True)
def get_sites(session_key):
    agent = get_agent(session_key)
    SupportedSite = frappe.qb.DocType("Supported Site")
    SupportedSiteUser = frappe.qb.DocType("Supported Site User")
    sites = (
        frappe.qb.from_(SupportedSite)
        .select(
            SupportedSite.site_name,
            SupportedSite.support_provider,
            Count(SupportedSiteUser.name).as_("user_count"),
        )
        .left_join(SupportedSiteUser)
        .on(SupportedSiteUser.parent == SupportedSite.name)
        .where(SupportedSite.support_provider == agent.support_provider)
        .groupby(SupportedSite.site_name)
        .run(as_dict=True)
    )
    return sites


@frappe.whitelist(allow_guest=True)
def clear_session_key(session_key):
    return delete_session_key(session_key)
