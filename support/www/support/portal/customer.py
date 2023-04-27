# Copyright (c) 2022, Frappe Technologies Pvt. Ltd. and Contributors
# GNU GPLv3 License. See license.txt

from __future__ import unicode_literals

import frappe

no_cache = 1


def get_context(context):
    path_to_view = {
        "support/portal/customer/issues/new": "new",
        "support/portal/customer/issues": "list",
        "support/portal/customer/issue": "form",
        "support/portal/customer/register": "register",
        "support/portal/customer": "login",
    }
    for path, view in path_to_view.items():
        if path in frappe.local.path:
            context.view = view
            break