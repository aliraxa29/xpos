import os
import re

import frappe
from frappe.website.page_renderers.base_renderer import BaseRenderer

PREFIX = "/xpos/"

ALLOWED = re.compile(r"\A(sw\.js(\.map)?|workbox-[A-Za-z0-9_-]+\.js(\.map)?|manifest\.webmanifest)\Z")

CONTENT_TYPES = {
	".js": "text/javascript; charset=utf-8",
	".map": "application/json; charset=utf-8",
	".webmanifest": "application/manifest+json; charset=utf-8",
}


def asset_dir() -> str:
	return frappe.get_app_path("xpos", "public", "xpos")


def resolve() -> tuple[str, str] | None:
	"""Map the raw request path to a built worker file, or None."""
	request = getattr(frappe.local, "request", None)
	if not request or not request.path.startswith(PREFIX):
		return None

	name = request.path[len(PREFIX) :]
	if not ALLOWED.match(name):
		return None

	base = os.path.realpath(asset_dir())
	path = os.path.realpath(os.path.join(base, name))

	if os.path.commonpath([base, path]) != base or not os.path.isfile(path):
		return None

	_, ext = os.path.splitext(name)
	return path, CONTENT_TYPES.get(ext, "application/octet-stream")


class ServiceWorkerPage(BaseRenderer):
	def can_render(self) -> bool:
		return resolve() is not None

	def render(self):
		path, content_type = resolve()

		with open(path, "rb") as handle:  # nosemgrep: frappe-security-file-traversal
			data = handle.read()

		return self.build_response(
			data,
			headers={
				"Content-Type": content_type,
				"Service-Worker-Allowed": PREFIX,
				"Cache-Control": "no-cache, no-store, must-revalidate",
			},
		)
