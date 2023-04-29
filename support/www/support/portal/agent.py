# Copyright (c) 2022, Frappe Technologies Pvt. Ltd. and Contributors
# GNU GPLv3 License. See license.txt

import frappe
from frappe.core.doctype.communication.email import make as create_communication
from frappe.desk.form.assign_to import add as add_assign
from frappe.desk.form.assign_to import remove as remove_assign
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
def get_agents(session_key):
    email = validate_session_key(session_key)
    if not email:
        frappe.throw("Invalid Session Key")

    SupportProvider = frappe.qb.DocType("Support Provider")
    SupportProviderTeam = frappe.qb.DocType("Support Provider Team")
    SupportTeamMember = frappe.qb.DocType("Support Team Member")
    User = frappe.qb.DocType("User")

    agents = (
        frappe.qb.from_(SupportProvider)
        .inner_join(SupportProviderTeam)
        .on(SupportProvider.name == SupportProviderTeam.support_provider)
        .inner_join(SupportTeamMember)
        .on(SupportProviderTeam.name == SupportTeamMember.parent)
        .inner_join(User)
        .on(SupportTeamMember.user == User.name)
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
    email = validate_session_key(session_key)
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
def add_agent(session_key, email):
    agent = get_agent(session_key)

    if frappe.db.exists("Support Team Member", {"user": email, "parent": agent.team}):
        frappe.msgprint("Agent already exists.", alert=True)
        return

    if not frappe.db.exists("User", email):
        frappe.msgprint("User does not exist.", alert=True)
        return

    user = frappe.get_doc("User", email)
    user.add_roles("Support Provider")
    agent_doc = frappe.get_doc("Support Provider Team", agent.team)
    agent_doc.append("members", {"user": email})
    agent_doc.save()

    return get_agent(session_key, email, with_tickets=False)


@frappe.whitelist(allow_guest=True)
def remove_agent(session_key, email):
    agent = get_agent(session_key)

    if not frappe.db.exists(
        "Support Team Member", {"user": email, "parent": agent.team}
    ):
        frappe.throw("Agent does not exist.")

    user = frappe.get_doc("User", email)
    user.remove_roles("Support Provider")
    agent_doc = frappe.get_doc("Support Provider Team", agent.team)
    for member in agent_doc.members:
        if member.user == email:
            agent_doc.remove(member)
            break
    agent_doc.save()


@frappe.whitelist(allow_guest=True)
def disable_agent(session_key, email):
    agent = get_agent(session_key)

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
def reply_to_ticket(session_key, issue_name, content):
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
    if assignee not in issue._assign:
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
    issue.save()
    return issue.status