<template>
	<div class="flex h-dvh flex-col overflow-hidden bg-background text-foreground antialiased" :dir="dir">
		<header
			class="flex flex-none items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-8 sm:py-5"
		>
			<div class="flex min-w-0 items-center gap-3.5">
				<img
					class="h-[clamp(38px,5vh,48px)] w-[clamp(38px,5vh,48px)] shrink-0 rounded-lg"
					:src="isDark ? logoDark : logoLight"
					alt="X POS"
				/>
				<div class="flex min-w-0 flex-col leading-tight">
					<span class="text-[clamp(18px,2.6vh,22px)] font-extrabold tracking-tight">{{
						appName
					}}</span>
					<span class="text-[clamp(11px,1.5vh,13px)] font-medium text-muted-foreground">
						{{ __("Price Checker") }}
					</span>
				</div>
			</div>

			<select
				v-if="profiles.length > 1"
				v-model="posProfile"
				:title="__('Store / Register')"
				class="max-w-[40vw] cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
				@change="scanRef?.focus()"
			>
				<option v-for="p in profiles" :key="p.name" :value="p.name">{{ p.name }}</option>
			</select>
		</header>

		<main
			class="flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(16px,3.5vh,32px)] overflow-hidden px-4 py-4 sm:px-10 sm:py-8"
		>
			<div class="relative w-full max-w-160 shrink-0">
				<ScanBarcode
					class="absolute top-1/2 -translate-y-1/2 text-muted-foreground"
					:class="dir === 'rtl' ? 'right-5.5' : 'left-5.5'"
				/>
				<input
					ref="scanRef"
					v-model="scanValue"
					type="text"
					inputmode="none"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					placeholder="Scan a barcode to check the price…"
					class="w-full rounded-[calc(var(--radius)+6px)] border-2 border-border bg-card py-[clamp(14px,2.4vh,22px)] text-[clamp(18px,2.8vh,24px)] text-foreground outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus:border-primary focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.18)]"
					:class="dir === 'rtl' ? 'pr-15 pl-6' : 'pl-15 pr-6'"
					@keydown.enter.prevent="doLookup(scanValue)"
				/>
			</div>

			<div class="flex w-full min-h-0 max-w-215 flex-1 items-center justify-center">
				<div
					v-if="stage === 'idle'"
					class="flex flex-col items-center gap-[clamp(8px,1.6vh,16px)] text-center text-muted-foreground"
				>
					<div class="text-[clamp(40px,9vh,64px)]">🛒</div>
					<h2 class="text-[clamp(18px,3.2vh,26px)] font-bold text-foreground">
						{{ __("Scan a barcode to see its price") }}
					</h2>
					<div>{{ __("Hold the item's barcode under the scanner.") }}</div>
				</div>

				<div
					v-else-if="stage === 'notfound'"
					class="flex flex-col items-center gap-[clamp(8px,1.6vh,16px)] text-center text-muted-foreground"
				>
					<div class="text-[clamp(40px,9vh,64px)]">🔎</div>
					<h2 class="text-[clamp(18px,3vh,24px)] font-bold text-destructive">
						{{ __("Barcode not recognised") }}
					</h2>
					<div>
						{{ __(`"${lastQuery}" isn't registered. Please scan again or ask a team member.`) }}
					</div>
				</div>

				<div
					v-else-if="stage === 'found' && item"
					class="grid w-full max-h-full animate-[pop_.18s_ease-out] grid-cols-1 items-center gap-[clamp(18px,3vw,32px)] overflow-hidden rounded-[calc(var(--radius)+12px)] border border-border bg-card p-[clamp(18px,3vh,32px)] shadow-soft sm:grid-cols-[clamp(120px,24vh,220px)_1fr] sm:text-left"
				>
					<div
						class="grid h-[clamp(120px,24vh,220px)] w-[clamp(120px,24vh,220px)] place-items-center overflow-hidden rounded-lg border border-border bg-muted justify-self-center sm:justify-self-auto"
					>
						<img
							v-if="item.image && !imageFailed"
							:src="item.image"
							alt=""
							class="h-full w-full object-cover"
							@error="imageFailed = true"
						/>
						<span v-else class="text-[clamp(48px,10vh,72px)] text-muted-foreground">📦</span>
					</div>

					<div
						class="flex min-w-0 flex-col items-center gap-[clamp(6px,1.2vh,10px)] overflow-hidden sm:items-start"
					>
						<span
							v-if="item.item_group"
							class="self-center rounded-full bg-primary/12 px-3 py-1 text-[clamp(11px,1.6vh,13px)] font-semibold text-primary sm:self-start"
						>
							{{ item.item_group }}
						</span>

						<div
							class="wrap-break-word text-[clamp(20px,4.4vh,34px)] font-extrabold leading-[1.12]"
						>
							{{ item.item_name }}
						</div>

						<div
							v-if="item.local_item_name && item.local_item_name !== item.item_name"
							class="text-[clamp(12px,1.8vh,15px)] text-muted-foreground"
						>
							{{ item.local_item_name }}
						</div>

						<div class="text-[clamp(12px,1.8vh,15px)] text-muted-foreground">
							Code: {{ item.item_code }}
						</div>

						<div
							v-if="item.description"
							class="line-clamp-2 text-[clamp(12px,1.7vh,14px)] text-muted-foreground"
						>
							{{ item.description }}
						</div>

						<div
							class="mt-[clamp(6px,1.4vh,12px)] flex flex-wrap items-baseline justify-center gap-3 sm:justify-start"
						>
							<template v-if="item.has_price">
								<span
									class="text-[clamp(32px,7vh,52px)] font-extrabold tracking-[-1px] text-primary"
								>
									{{ money(item.symbol, item.rate) }}
								</span>
								<span class="text-[clamp(13px,2vh,16px)] text-muted-foreground"
									>per {{ item.uom }}</span
								>
							</template>
							<span
								v-else
								class="text-[clamp(16px,2.6vh,22px)] font-bold text-muted-foreground"
							>
								{{ __("Price on request") }}
							</span>
						</div>

						<div
							v-if="item.is_stock_item"
							class="mt-[clamp(8px,1.6vh,14px)] flex flex-wrap justify-center gap-2.5 sm:justify-start"
						>
							<span
								v-if="item.in_stock"
								class="rounded-full bg-emerald-500/10 px-3.5 py-1.5 text-[clamp(12px,1.8vh,14px)] font-semibold text-emerald-500"
							>
								✓ {{ __("In Stock") }}
							</span>
							<span
								v-else
								class="rounded-full bg-destructive/10 px-3.5 py-1.5 text-[clamp(12px,1.8vh,14px)] font-semibold text-destructive"
							>
								{{ __("Out of stock") }}
							</span>
						</div>
					</div>
				</div>
			</div>
		</main>

		<footer
			class="flex-none border-t border-border px-3 py-2.5 text-center text-[clamp(11px,1.5vh,13px)] text-muted-foreground"
		>
			<span>{{ __("Barcode scanner ready · results clear automatically") }}</span>
		</footer>
	</div>
</template>

<script setup>
import { call } from "@/services/api";
import { formatFor } from "@/composables/useCurrency";
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from "vue";
import __ from "@/lib/translate";
import { ScanBarcode } from "lucide-vue-next";
import { useBranding } from "@/composables/useBranding";

const { logoLight, logoDark } = useBranding();

const props = defineProps({
	appName: { type: String, default: "X POS" },
	csrfToken: { type: String, default: "" },
	lang: { type: String, default: "en" },
	dir: { type: String, default: "ltr" },
	resetDelayMs: { type: Number, default: 20000 },
});

const scanRef = ref(null);
const scanValue = ref("");
const stage = ref("idle");
const item = reactive({});
const lastQuery = ref("");
const imageFailed = ref(false);
const isDark = ref(false);
const profiles = ref([]);
const posProfile = ref(null);
let resetTimer = null;

function money(sym, val) {
	const n = formatFor(item.currency, Number(val || 0));
	return (sym || "") + " " + n;
}

function scheduleReset(ms) {
	clearTimeout(resetTimer);
	resetTimer = setTimeout(() => {
		stage.value = "idle";
		scanRef.value?.focus();
	}, ms);
}

async function doLookup(raw) {
	const q = (raw || "").trim();
	if (!q) return;
	lastQuery.value = q;
	try {
		const params = { barcode: q };
		if (posProfile.value) params.pos_profile = posProfile.value;
		const d = await call("xpos.api.price_check.lookup", params);
		if (d.item_code) {
			Object.assign(item, d);
			imageFailed.value = false;
			stage.value = "found";
		} else {
			stage.value = "notfound";
		}
	} catch (e) {
		stage.value = "notfound";
	}
	scanValue.value = "";
	scheduleReset(props.resetDelayMs);
}

function focusScan() {
	scanRef.value?.focus();
}

onMounted(async () => {
	document.addEventListener("click", focusScan);
	window.addEventListener("focus", focusScan);

	try {
		const ctx = await call("xpos.api.price_check.get_terminal_context", {});
		const list = (ctx && ctx.pos_profiles) || [];
		profiles.value = list;
		if (list.length >= 1) posProfile.value = list[0].name;
	} catch (e) {
		/* fall back to system defaults */
	}

	await nextTick();
	focusScan();
});

onBeforeUnmount(() => {
	document.removeEventListener("click", focusScan);
	window.removeEventListener("focus", focusScan);
	clearTimeout(resetTimer);
});
</script>

<style scoped>
@keyframes pop {
	from {
		opacity: 0;
		transform: translateY(10px) scale(0.99);
	}

	to {
		opacity: 1;
		transform: none;
	}
}
</style>
