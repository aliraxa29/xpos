import { getSetting, setSetting } from "./dbBridge";

export type ColorTokens = Record<string, string>;

export interface BrandingPayload {
	light?: ColorTokens;
	dark?: ColorTokens;
	radius?: number;
	logo_light?: string;
	logo_dark?: string;
	favicon?: string;
	splash_background?: string;
	enable_splash?: number | boolean;
}

export const BRANDING_TOKENS = [
	"background",
	"foreground",
	"card",
	"card_foreground",
	"popover",
	"popover_foreground",
	"primary",
	"primary_foreground",
	"secondary",
	"secondary_foreground",
	"muted",
	"muted_foreground",
	"accent",
	"accent_foreground",
	"destructive",
	"destructive_foreground",
	"border",
	"input",
	"ring",
] as const;

const STYLE_ID = "xpos-branding";
const CACHE_KEY = "xpos_branding";

export function hexToHslTriplet(hex: string): string | null {
	if (!hex) return null;
	let h = hex.trim().replace(/^#/, "");
	if (h.length === 3) {
		h = h
			.split("")
			.map((c) => c + c)
			.join("");
	}
	if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;

	const r = parseInt(h.slice(0, 2), 16) / 255;
	const g = parseInt(h.slice(2, 4), 16) / 255;
	const b = parseInt(h.slice(4, 6), 16) / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	let s = 0;
	let hue = 0;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				hue = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				hue = (b - r) / d + 2;
				break;
			default:
				hue = (r - g) / d + 4;
		}
		hue /= 6;
	}

	const H = Math.round(hue * 360);
	const S = Math.round(s * 1000) / 10;
	const L = Math.round(l * 1000) / 10;
	return `${H} ${S}% ${L}%`;
}

function buildBlock(selector: string, tokens: ColorTokens | undefined, radius?: number): string {
	const decls: string[] = [];
	if (tokens) {
		for (const token of BRANDING_TOKENS) {
			const triplet = hexToHslTriplet(tokens[token] || "");
			if (triplet) decls.push(`--${token.replace(/_/g, "-")}: ${triplet};`);
		}
	}
	if (selector === ":root" && typeof radius === "number" && radius > 0) {
		decls.push(`--radius: ${radius}rem;`);
	}
	if (!decls.length) return "";
	return `${selector} {\n\t${decls.join("\n\t")}\n}`;
}

function setFavicon(url: string) {
	if (!url) return;
	let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
	if (!link) {
		link = document.createElement("link");
		link.rel = "icon";
		document.head.appendChild(link);
	}
	link.href = url;
}

function setThemeColor(color: string) {
	if (!color) return;
	let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
	if (!meta) {
		meta = document.createElement("meta");
		meta.name = "theme-color";
		document.head.appendChild(meta);
	}
	meta.content = color;
}

export function applyBranding(branding: BrandingPayload | null | undefined) {
	if (!branding) return;

	const blocks = [
		buildBlock(":root", branding.light, branding.radius),
		buildBlock(".dark", branding.dark),
	].filter(Boolean);

	if (blocks.length) {
		let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
		if (!style) {
			style = document.createElement("style");
			style.id = STYLE_ID;
			document.head.appendChild(style);
		}
		style.textContent = blocks.join("\n");
	}

	setFavicon(branding.favicon || branding.logo_light || "");
	setThemeColor(branding.splash_background || (branding.light && branding.light.primary) || "");
}

export function getBootBranding(): BrandingPayload | null {
	const boot = window.xpos?.boot?.xpos_branding as BrandingPayload | undefined;
	return boot && Object.keys(boot).length ? boot : null;
}

export async function getCachedBranding(): Promise<BrandingPayload | null> {
	try {
		const raw = await getSetting(CACHE_KEY);
		return raw ? (JSON.parse(raw) as BrandingPayload) : null;
	} catch {
		return null;
	}
}

export async function cacheBranding(branding: BrandingPayload): Promise<void> {
	try {
		await setSetting(CACHE_KEY, JSON.stringify(branding), "branding");
	} catch {}
}
