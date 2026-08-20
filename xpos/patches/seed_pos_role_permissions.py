from xpos.install import seed_default_roles, seed_pos_permissions


def execute():
	"""
	Seed the POS Permission catalog and default POS Roles on existing sites.
	"""
	seed_pos_permissions()
	seed_default_roles()
