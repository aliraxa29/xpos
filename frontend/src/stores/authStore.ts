import { call } from "@/services/api";
import { isElectron } from "@/services/electronBridge";
import { loadPermissions, resetPermissions } from "@/services/userRights";
import { UserSession } from "@/types/pos.types";
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { isOnline, isNetworkError } from "@/utils";

function friendlyMessage(err: unknown, fallback: string): string {
	if (isNetworkError(err)) return "Cannot reach the server. Check your connection and try again.";
	const message = err instanceof Error ? err.message : "";
	if (!message || message.includes("Traceback") || message.startsWith("__")) return fallback;
	return message;
}

export const useAuthStore = defineStore("auth", () => {
	const isLoading = ref(false);
	const isAuthenticated = ref(false);
	const user = ref<UserSession | null>(null);
	const error = ref("");
	const resetEmailSent = ref(false);
	const isOfflineAuth = ref(false);

	const userName = computed(() => user.value?.user || "Guest");
	const userEmail = computed(() => user.value?.user_email || "");
	const userFullName = computed(() => user.value?.user_fullname || "");
	const isGuest = computed(() => !user.value || user.value.user === "Guest");
	const isSystemManager = computed(() =>
		Boolean((window.xpos?.boot as Record<string, unknown> | undefined)?.xpos_is_system_manager),
	);
	const canManagePermissions = computed(() =>
		Boolean((window.xpos?.boot as Record<string, unknown> | undefined)?.xpos_can_manage_permissions),
	);

	async function checkAuth(): Promise<boolean> {
		try {
			isLoading.value = true;
			error.value = "";

			if (isElectron()) {
				return await checkOfflineAuth();
			}

			const response = await call("frappe.auth.get_logged_user");

			if (!response) {
				isAuthenticated.value = false;
				user.value = null;
				return false;
			}
			const loggedUser = response as string;

			if (loggedUser && loggedUser !== "Guest") {
				isAuthenticated.value = true;
				isOfflineAuth.value = false;
				if (window.xpos) {
					const bootUserInfo = xpos?.boot?.user_info[loggedUser] as any;
					user.value = {
						user: loggedUser,
						user_email: bootUserInfo?.user_email || loggedUser,
						user_fullname: bootUserInfo?.user_fullname || loggedUser,
						image: bootUserInfo?.image || "",
					};
				}
				await loadPermissions(loggedUser);
				return true;
			}

			isAuthenticated.value = false;
			user.value = null;
			return false;
		} catch (err) {
			console.error("Auth check failed:", err);
			if (isAuthenticated.value && !isOnline()) {
				return true;
			}
			isAuthenticated.value = false;
			user.value = null;
			return false;
		} finally {
			isLoading.value = false;
		}
	}

	async function checkOfflineAuth(): Promise<boolean> {
		try {
			const lastUser = await window.electronAPI!.db.getSetting("last_logged_user");
			if (!lastUser) return false;

			const posUser = (await window.electronAPI!.db.getPosUser(lastUser)) as Record<
				string,
				unknown
			> | null;
			if (!posUser || posUser.enabled === 0 || posUser.enabled === false) {
				return false;
			}

			isAuthenticated.value = true;
			isOfflineAuth.value = true;
			user.value = {
				user: lastUser,
				user_email: (posUser.email as string) || lastUser,
				user_fullname: (posUser.full_name as string) || lastUser,
			};

			window
				.electronAPI!.startSyncEngine()
				.catch((err) => console.warn("[XPOS] startSyncEngine error:", err));

			await loadPermissions(lastUser);
			return true;
		} catch (err) {
			console.error("Offline auth check failed:", err);
			return false;
		}
	}

	async function login(username: string, password: string): Promise<boolean> {
		try {
			isLoading.value = true;
			error.value = "";

			if (isElectron()) {
				return await loginOffline(username, password);
			}

			await call("login", {
				usr: username,
				pwd: password,
			});

			isAuthenticated.value = true;
			isOfflineAuth.value = false;
			user.value = {
				user: username,
				user_email: username,
			};

			await loadPermissions(username);
			return true;
		} catch (err) {
			console.error("Login failed:", err);
			error.value = friendlyMessage(err, "Invalid login credentials.");
			return false;
		} finally {
			isLoading.value = false;
		}
	}

	async function loginOffline(username: string, password: string): Promise<boolean> {
		try {
			const posUser = await window.electronAPI!.db.getPosUser(username);
			if (!posUser) {
				error.value = "User not found. Check your username.";
				return false;
			}

			const userData = posUser as Record<string, unknown>;
			if (!userData.password_hash) {
				error.value = "No password configured for this user.";
				return false;
			}

			const valid = await window.electronAPI!.db.verifyPassword(username, password);
			if (!valid) {
				error.value = "Invalid password";
				return false;
			}

			isAuthenticated.value = true;
			isOfflineAuth.value = true;
			user.value = {
				user: username,
				user_email: (userData.email as string) || username,
				user_fullname: (userData.full_name as string) || username,
			};

			await window.electronAPI!.db.setSetting("last_logged_user", username, "auth");
			window
				.electronAPI!.startSyncEngine()
				.then((result) => {
					if (!result.success) {
						console.warn("[XPOS] Sync engine start failed:", result.error);
					}
				})
				.catch((err) => {
					console.warn("[XPOS] startSyncEngine error:", err);
				});

			await loadPermissions(username);
			return true;
		} catch (err) {
			console.error("Login failed:", err);
			error.value = friendlyMessage(err, "Could not sign in. Please try again.");
			return false;
		}
	}

	async function sendResetPasswordEmail(email: string): Promise<boolean> {
		try {
			isLoading.value = true;
			error.value = "";
			resetEmailSent.value = false;

			await call("frappe.core.doctype.user.user.reset_password", { user: email });

			resetEmailSent.value = true;
			return true;
		} catch (err) {
			console.error("Reset password failed:", err);
			error.value = friendlyMessage(err, "Failed to send reset email.");
			return false;
		} finally {
			isLoading.value = false;
		}
	}

	async function logout(): Promise<void> {
		try {
			isLoading.value = true;

			if (!isOfflineAuth.value) {
				await call("logout");
			}

			isAuthenticated.value = false;
			isOfflineAuth.value = false;
			user.value = null;
			resetPermissions();

			if (isElectron()) {
				try {
					await window.electronAPI!.db.setSetting("last_logged_user", "", "auth");
				} catch {
					/* ignore */
				}
				window.location.hash = "#/login";
				window.location.reload();
			} else {
				window.location.href = "/xpos/login";
			}
		} catch (err) {
			console.error("Logout failed:", err);
		} finally {
			isLoading.value = false;
		}
	}

	function clearError(): void {
		error.value = "";
	}

	function $reset(): void {
		isLoading.value = false;
		isAuthenticated.value = false;
		isOfflineAuth.value = false;
		user.value = null;
		error.value = "";
		resetEmailSent.value = false;
		resetPermissions();
	}

	return {
		isLoading,
		isAuthenticated,
		isOfflineAuth,
		user,
		error,
		resetEmailSent,
		userName,
		userEmail,
		userFullName,
		isGuest,
		isSystemManager,
		canManagePermissions,
		checkAuth,
		login,
		sendResetPasswordEmail,
		logout,
		clearError,
		$reset,
	};
});
