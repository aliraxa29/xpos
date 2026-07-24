import { computed, ref } from "vue";

import DefaultLogoDark from "@/assets/images/xpos-logo-dark.svg";
import DefaultLogoLight from "@/assets/images/xpos-logo-light.svg";
import { call } from "@/services/api";
import {
	applyBranding,
	cacheBranding,
	getBootBranding,
	getCachedBranding,
	type BrandingPayload,
} from "@/services/branding";

const branding = ref<BrandingPayload | null>(null);
let initialized = false;

export function useBranding() {
	const logoLight = computed(() => branding.value?.logo_light || DefaultLogoLight);
	const logoDark = computed(() => branding.value?.logo_dark || DefaultLogoDark);
	const splashBackground = computed(() => branding.value?.splash_background || "");
	const enableSplash = computed(() => {
		const v = branding.value?.enable_splash;
		return v === undefined || v === null ? true : !!Number(v);
	});

	async function initBranding(): Promise<void> {
		if (initialized) return;
		initialized = true;

		const boot = getBootBranding();
		if (boot) {
			branding.value = boot;
			applyBranding(boot);
		} else {
			const cached = await getCachedBranding();
			if (cached) {
				branding.value = cached;
				applyBranding(cached);
			}
		}

		try {
			const fresh = await call<BrandingPayload>("xpos.api.settings.get_xpos_branding");
			if (fresh && Object.keys(fresh).length) {
				branding.value = fresh;
				applyBranding(fresh);
				await cacheBranding(fresh);
			}
		} catch {}
	}

	return { branding, logoLight, logoDark, splashBackground, enableSplash, initBranding };
}
