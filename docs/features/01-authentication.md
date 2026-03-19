# Authentication & Login

X POS provides a dedicated login experience separate from the standard Frappe desk, designed for cashiers and POS operators.

---

## Login Screen

- Navigate to `/xpos/login` to access the POS login page
- Enter your **email/username** and **password**
- Click **Login** to authenticate
- A **show/hide password** toggle is available for convenience

## Session Persistence

- If you are already logged into Frappe, X POS automatically detects your active session
- When an active session is found, you are redirected directly to the POS screen without needing to re-enter credentials
- The system checks your session status on every app load via `frappe.auth.get_logged_user`

## Password Reset

- Click the **"Forgot password?"** link on the login screen
- Enter your registered email address
- A password reset link will be sent to your email via Frappe's built-in reset mechanism
- Follow the link to set a new password, then return to X POS to log in

## Redirect After Login

- If you attempt to access a protected POS page (e.g., `/xpos/pos`) while logged out, you are redirected to the login page
- After successful login, you are automatically taken back to the page you originally tried to access
- This is handled via the `?redirect=` query parameter

## Logout

- Click the **Logout** button (available in the POS navigation bar)
- Your session is cleared and you are redirected to `/xpos/login`
- All local session data is removed

---

## Security Notes

- Authentication uses standard Frappe session management with secure cookies
- POS access is controlled by Frappe user roles and POS Profile assignments
- Only users assigned to a POS Profile can open a shift and use the POS
- Role-based permissions restrict which operations each user can perform
