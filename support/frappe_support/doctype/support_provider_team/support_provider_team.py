# Copyright (c) 2023, developers@frappe.io and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class SupportProviderTeam(Document):
    def on_update(self):
        old_user = frappe.session.user
        frappe.set_user("Administrator")

        rule_name = self.get_rule_name()
        if rule_name:
            rule = frappe.get_doc("Assignment Rule", rule_name)
            rule.users = []
            for member in self.members:
                rule.append("users", {"user": member.user})
            rule.save(ignore_permissions=True)
            return

        self.create_assignment_rule()

        frappe.set_user(old_user)

    def create_assignment_rule(self):
        rule = frappe.new_doc("Assignment Rule")
        rule.name = f"{self.support_provider} - {self.name}"
        rule.document_type = "Issue"
        rule.priority = 1
        rule.disabled = 0
        rule.description = "Automatic Assignment"
        rule.assign_condition = (
            f'status=="Open" and support_provider=="{self.support_provider}"'
        )
        rule.unassign_condition = f'support_provider!="{self.support_provider}"'
        rule.close_condition = 'status == "Closed"'
        rule.rule = "Round Robin"
        rule.users = []
        days = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
        ]
        for day in days:
            rule.append("assignment_days", {"day": day})
        rule.save(ignore_permissions=True)

    def get_rule_name(self):
        return frappe.db.get_value(
            "Assignment Rule", f"{self.support_provider} - {self.name}", "name"
        )
