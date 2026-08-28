<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { usePurchaseStore } from "@/stores/purchaseStore";
import { usePosStore } from "@/stores/posStore";
import { useMoney } from "@/composables/useMoney";
import {
	PackageCheck,
	ArrowLeft,
	RefreshCw,
	CheckCircle2,
	ChevronRight,
	AlertTriangle,
	Loader2,
	ArrowRightLeft,
	CornerDownLeft,
	Warehouse,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { InTransitEntry, ReceiveTransitItem, ReturnShortageItem } from "@/types/pos.types";
import __ from "@/lib/translate";

const purchaseStore = usePurchaseStore();
const posStore = usePosStore();
const { money, ratePrecision, percent, qty } = useMoney();

interface TransitFormItem {
	ste_detail: string;
	item_code: string;
	item_name: string;
	original_qty: number;
	pending_qty: number;
	receive_qty: number;
	return_qty: number;
	uom: string;
	basic_rate: number;
	s_warehouse: string;
	t_warehouse: string;
}

const transitFormItems = ref<TransitFormItem[]>([]);
const transitRemarks = ref("");
const isSubmittingTransit = ref(false);

const hasTransitFormData = computed(() => transitFormItems.value.some((i) => i.receive_qty > 0));

const hasShortageData = computed(() => transitFormItems.value.some((i) => i.return_qty > 0));

function formatDate(d: string): string {
	if (!d) return "";
	const dt = new Date(d);
	return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function selectTransit(entry: InTransitEntry): Promise<void> {
	const detail = await purchaseStore.fetchTransitDetail(entry.name);
	if (detail) {
		transitFormItems.value = detail.items
			.filter((i) => i.pending_qty > 0)
			.map((item) => ({
				ste_detail: item.ste_detail,
				item_code: item.item_code,
				item_name: item.item_name,
				original_qty: item.qty,
				pending_qty: item.pending_qty,
				receive_qty: item.pending_qty,
				return_qty: 0,
				uom: item.uom,
				basic_rate: item.basic_rate,
				s_warehouse: item.s_warehouse,
				t_warehouse: item.t_warehouse,
			}));
		transitRemarks.value = "";
	}
}

function goBackToTransitList(): void {
	purchaseStore.clearSelectedTransit();
	transitFormItems.value = [];
	transitRemarks.value = "";
}

function receiveAllTransit(index: number): void {
	const item = transitFormItems.value[index];
	item.receive_qty = item.pending_qty;
	item.return_qty = 0;
}

function returnAllTransit(index: number): void {
	const item = transitFormItems.value[index];
	item.receive_qty = 0;
	item.return_qty = item.pending_qty;
}

function onTransitReceiveChange(index: number): void {
	const item = transitFormItems.value[index];
	if (item.receive_qty < 0) item.receive_qty = 0;
	if (item.receive_qty > item.pending_qty) item.receive_qty = item.pending_qty;
	item.return_qty = Math.min(item.return_qty, item.pending_qty - item.receive_qty);
}

function onTransitReturnChange(index: number): void {
	const item = transitFormItems.value[index];
	if (item.return_qty < 0) item.return_qty = 0;
	if (item.return_qty > item.pending_qty) item.return_qty = item.pending_qty;
	item.receive_qty = Math.min(item.receive_qty, item.pending_qty - item.return_qty);
}

async function submitTransitReceive(): Promise<void> {
	if (!purchaseStore.selectedTransit || (!hasTransitFormData.value && !hasShortageData.value)) return;

	const entryName = purchaseStore.selectedTransit.name;

	isSubmittingTransit.value = true;
	try {
		const receiveItems: ReceiveTransitItem[] = transitFormItems.value
			.filter((i) => i.receive_qty > 0)
			.map((i) => ({
				ste_detail: i.ste_detail,
				item_code: i.item_code,
				receive_qty: i.receive_qty,
			}));

		if (receiveItems.length > 0) {
			await purchaseStore.receiveTransitStock(entryName, receiveItems, transitRemarks.value);
		}

		const returnItems: ReturnShortageItem[] = transitFormItems.value
			.filter((i) => i.return_qty > 0)
			.map((i) => ({
				ste_detail: i.ste_detail,
				item_code: i.item_code,
				return_qty: i.return_qty,
				reason: transitRemarks.value,
			}));

		if (returnItems.length > 0) {
			await purchaseStore.returnShortageToSource(entryName, returnItems, transitRemarks.value);
		}

		goBackToTransitList();
	} finally {
		isSubmittingTransit.value = false;
	}
}

onMounted(() => {
	purchaseStore.fetchInTransitTransfers();
});
</script>

<template>
	<div class="h-full flex flex-col overflow-hidden bg-card">
		<template v-if="purchaseStore.selectedTransit">
			<div class="p-4 border-b border-border bg-muted shrink-0">
				<div class="flex items-center gap-3">
					<Button @click="goBackToTransitList" variant="ghost" size="icon" class="shrink-0">
						<ArrowLeft class="w-4 h-4" />
					</Button>
					<div class="flex-1 min-w-0">
						<h3 class="font-semibold text-foreground truncate">
							{{ purchaseStore.selectedTransit.name }}
						</h3>
						<p class="text-sm text-muted-foreground truncate">
							{{
								purchaseStore.selectedTransit.source_warehouse ||
								purchaseStore.selectedTransit.from_warehouse
							}}
							&rarr;
							{{
								purchaseStore.selectedTransit.transit_warehouse ||
								purchaseStore.selectedTransit.to_warehouse
							}}
						</p>
					</div>
					<Badge
						variant="secondary"
						class="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
					>
						{{ percent(purchaseStore.selectedTransit.per_transferred, 0) }}
						{{ __("transferred") }}
					</Badge>
				</div>
			</div>

			<div class="px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-border shrink-0">
				<p class="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
					<Warehouse class="w-3.5 h-3.5" />
					{{ __("Receiving at") }}: <strong>{{ posStore.warehouse }}</strong>
				</p>
			</div>

			<ScrollArea class="flex-1 min-h-0">
				<div class="divide-y divide-border">
					<div
						v-for="(item, index) in transitFormItems"
						:key="item.ste_detail"
						class="p-4 space-y-3"
					>
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0">
								<p class="font-medium text-foreground truncate">
									{{ item.item_name }}
								</p>
								<p class="text-xs text-muted-foreground">
									{{ item.item_code }} &middot; {{ item.uom }}
								</p>
							</div>
							<div class="text-end shrink-0">
								<p class="text-sm font-medium text-foreground">
									{{ money(item.basic_rate) }}
								</p>
								<p class="text-xs text-muted-foreground">
									{{ __("In Transit") }}:
									<span class="font-semibold">{{ item.pending_qty }}</span>
								</p>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="text-xs text-muted-foreground mb-1 flex items-center gap-1">
									<CheckCircle2 class="w-3 h-3 text-green-500" />
									{{ __("Receive Qty") }}
								</label>
								<div class="flex items-center gap-1">
									<NumberInput
										v-model="item.receive_qty"
										@change="onTransitReceiveChange(index)"
										:min="0"
										:max="item.pending_qty"
										:precision="ratePrecision"
										class="h-8"
									/>
									<Button
										@click="receiveAllTransit(index)"
										variant="outline"
										size="sm"
										class="h-8 text-xs px-2 shrink-0"
										>{{ __("All") }}</Button
									>
								</div>
							</div>
							<div>
								<label class="text-xs text-muted-foreground mb-1 flex items-center gap-1">
									<CornerDownLeft class="w-3 h-3 text-amber-500" />
									{{ __("Return Qty") }}
								</label>
								<div class="flex items-center gap-1">
									<NumberInput
										v-model="item.return_qty"
										@change="onTransitReturnChange(index)"
										:min="0"
										:max="item.pending_qty"
										:precision="ratePrecision"
										class="h-8"
									/>
									<Button
										@click="returnAllTransit(index)"
										variant="outline"
										size="sm"
										class="h-8 text-xs px-2 text-amber-600 shrink-0"
										>{{ __("All") }}</Button
									>
								</div>
							</div>
						</div>

						<div
							v-if="item.return_qty > 0"
							class="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400"
						>
							<CornerDownLeft class="w-3 h-3" />
							<span
								>{{ qty(item.return_qty) }} {{ item.uom }} {{ __("will be returned to") }}
								{{ item.s_warehouse }}</span
							>
						</div>

						<div
							v-if="item.pending_qty - item.receive_qty - item.return_qty > 0"
							class="flex items-center gap-2 text-xs text-red-500"
						>
							<AlertTriangle class="w-3 h-3" />
							<span
								>{{ qty(item.pending_qty - item.receive_qty - item.return_qty) }}
								{{ item.uom }} {{ __("unaccounted") }}</span
							>
						</div>
					</div>
				</div>
			</ScrollArea>

			<div class="p-4 border-t border-border bg-muted shrink-0 space-y-3">
				<Input
					v-model="transitRemarks"
					:placeholder="__('Remarks (optional, e.g. missing or damaged items)')"
					class="text-sm"
				/>
				<div class="flex gap-2">
					<Button @click="goBackToTransitList" variant="outline" class="flex-1">{{
						__("Cancel")
					}}</Button>
					<Button
						@click="submitTransitReceive"
						class="flex-1"
						:disabled="(!hasTransitFormData && !hasShortageData) || isSubmittingTransit"
					>
						<PackageCheck class="w-4 h-4 me-1" />
						{{ isSubmittingTransit ? __("Processing...") : __("Receive & Return") }}
					</Button>
				</div>
			</div>
		</template>
		<template v-else>
			<div class="p-4 border-b border-border bg-muted shrink-0">
				<div class="flex items-center justify-between">
					<h3 class="font-semibold text-foreground flex items-center gap-2">
						<ArrowRightLeft class="w-5 h-5" />
						{{ __("In-Transit Stock") }}
					</h3>
					<Button
						@click="purchaseStore.fetchInTransitTransfers()"
						variant="outline"
						size="sm"
						:disabled="purchaseStore.isLoadingTransits"
					>
						<RefreshCw
							class="w-4 h-4 me-1"
							:class="{ 'animate-spin': purchaseStore.isLoadingTransits }"
						/>
						{{ __("Refresh") }}
					</Button>
				</div>
				<p class="text-xs text-muted-foreground mt-1">
					{{ __("Material transfers awaiting receipt at your warehouse") }}
				</p>
			</div>

			<ScrollArea class="flex-1 min-h-0">
				<div v-if="purchaseStore.isLoadingTransits" class="p-8 text-center text-muted-foreground">
					<Loader2 class="w-8 h-8 mx-auto mb-3 animate-spin text-muted-foreground/40" />
					<p>{{ __("Loading in-transit stock...") }}</p>
				</div>

				<div
					v-else-if="purchaseStore.inTransitEntries.length === 0"
					class="p-8 text-center text-muted-foreground"
				>
					<ArrowRightLeft class="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
					<p class="font-medium">{{ __("No in-transit stock") }}</p>
					<p class="text-sm mt-1">{{ __("No material transfers pending receipt") }}</p>
				</div>

				<div v-else class="divide-y divide-border">
					<button
						v-for="entry in purchaseStore.inTransitEntries"
						:key="entry.name"
						@click="selectTransit(entry)"
						class="w-full p-4 text-start hover:bg-muted transition-colors flex items-center gap-3"
					>
						<div
							class="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0"
						>
							<ArrowRightLeft class="w-5 h-5 text-blue-600 dark:text-blue-400" />
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center justify-between">
								<p class="font-medium text-foreground truncate">
									{{ entry.name }}
								</p>
								<Badge
									variant="secondary"
									class="shrink-0 ms-2 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
								>
									{{ entry.total_pending_items }} {{ __("items") }}
								</Badge>
							</div>
							<p class="text-sm text-muted-foreground truncate">
								{{ entry.source_warehouse || entry.from_warehouse }} &rarr;
								{{ __("In Transit") }}
							</p>
							<div class="flex items-center gap-3 mt-1 text-xs text-muted-foreground/70">
								<span>{{ formatDate(entry.posting_date) }}</span>
								<span>{{ money(entry.total_amount) }}</span>
								<span>{{ percent(entry.per_transferred, 0) }} {{ __("received") }}</span>
							</div>
						</div>
						<ChevronRight class="w-4 h-4 text-muted-foreground shrink-0" />
					</button>
				</div>
			</ScrollArea>
		</template>
	</div>
</template>
