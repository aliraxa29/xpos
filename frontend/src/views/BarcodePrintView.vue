<template>
	<div class="flex flex-col h-full overflow-hidden">
		<div class="shrink-0 px-6 py-4 border-b border-border bg-background">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-xl font-bold text-foreground">{{ __("Barcode Printer") }}</h1>
					<p class="text-sm text-muted-foreground mt-0.5">
						{{ __("Generate and print barcode labels for items") }}
					</p>
				</div>
				<div class="flex items-center gap-2">
					<Button variant="outline" size="sm" @click="clearAll" :disabled="items.length === 0">
						<Trash2 class="w-4 h-4 me-1" />
						{{ __("Clear All") }}
					</Button>
					<Button size="sm" @click="printLabels" :disabled="items.length === 0 || isPrinting">
						<Printer class="w-4 h-4 me-1" />
						{{ isPrinting ? __("Generating...") : __("Print Labels") }}
					</Button>
				</div>
			</div>
		</div>

		<div class="flex-1 flex overflow-hidden">
			<div class="w-[420px] flex flex-col border-e border-border shrink-0">
				<div class="p-4 pb-2 space-y-3">
					<div class="relative">
						<Search
							class="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
						/>
						<input
							ref="searchInput"
							v-model="searchQuery"
							type="text"
							:placeholder="__('Search items by name, code, or barcode...')"
							class="w-full h-9 ps-9 pe-3 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
							@input="onSearch"
							@keydown.enter="onSearchEnter"
						/>
					</div>

					<div class="grid grid-cols-2 gap-2">
						<div>
							<label class="text-xs font-medium text-muted-foreground mb-1 block">
								{{ __("Barcode Type") }}
							</label>
							<select
								v-model="barcodeType"
								class="w-full h-8 px-2 text-xs border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
							>
								<option value="code128">CODE 128</option>
								<option value="code39">CODE 39</option>
								<option value="ean13">EAN-13</option>
								<option value="ean8">EAN-8</option>
								<option value="upca">UPC-A</option>
								<option value="itf">ITF</option>
							</select>
						</div>
						<div>
							<label class="text-xs font-medium text-muted-foreground mb-1 block">
								{{ __("Label Size") }}
							</label>
							<select
								v-model="labelSize"
								class="w-full h-8 px-2 text-xs border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
							>
								<option value="small">{{ __("Small (38x25mm)") }}</option>
								<option value="medium">{{ __("Medium (50x30mm)") }}</option>
								<option value="large">{{ __("Large (60x40mm)") }}</option>
								<option value="custom">{{ __("Custom") }}</option>
							</select>
						</div>
					</div>

					<div v-if="labelSize === 'custom'" class="grid grid-cols-2 gap-2">
						<div>
							<label class="text-xs font-medium text-muted-foreground mb-1 block">
								{{ __("Width (mm)") }}
							</label>
							<NumberInput
								v-model="customWidth"
								:min="10"
								:max="200"
								class="w-full h-8 px-2 text-xs border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
						<div>
							<label class="text-xs font-medium text-muted-foreground mb-1 block">
								{{ __("Height (mm)") }}
							</label>
							<NumberInput
								v-model="customHeight"
								:min="10"
								:max="200"
								class="w-full h-8 px-2 text-xs border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
							/>
						</div>
					</div>

					<div class="flex items-center gap-4">
						<label class="flex items-center gap-2 text-xs cursor-pointer">
							<Checkbox
								:checked="showPrice"
								@update:checked="showPrice = Boolean($event)"
								class="rounded"
							/>
							<span class="select-none">{{ __("Show Price") }}</span>
						</label>
						<label class="flex items-center gap-2 text-xs cursor-pointer">
							<Checkbox
								:checked="includeQR"
								@update:checked="includeQR = Boolean($event)"
								class="rounded"
							/>
							<span class="select-none">{{ __("Include QR Code") }}</span>
						</label>
					</div>
				</div>

				<div class="flex-1 overflow-y-auto px-4 pb-4 xpos-scrollbar">
					<div v-if="isSearching" class="flex items-center justify-center py-8">
						<div
							class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"
						></div>
					</div>
					<div
						v-else-if="searchResults.length === 0 && searchQuery"
						class="text-center py-8 text-muted-foreground text-sm"
					>
						{{ __("No items found") }}
					</div>
					<div
						v-else-if="searchResults.length === 0 && !searchQuery"
						class="text-center py-8 text-muted-foreground text-sm"
					>
						{{ __("Search for items to add barcode labels") }}
					</div>
					<div v-else class="space-y-1">
						<button
							v-for="item in searchResults"
							:key="item.item_code"
							class="w-full text-start px-3 py-2.5 rounded-md border border-transparent hover:border-border hover:bg-muted/50 transition-colors"
							@click="addItem(item)"
						>
							<div class="flex items-center justify-between">
								<div class="min-w-0 flex-1">
									<div class="text-sm font-medium truncate">
										{{ item.item_name }}
									</div>
									<div class="text-xs text-muted-foreground">
										{{ item.item_code }}
									</div>
								</div>
								<div class="flex items-center gap-2 shrink-0 ms-2">
									<span
										v-if="item.barcodes && item.barcodes.length === 1"
										class="text-xs text-muted-foreground font-mono"
										>{{ item.barcodes[0].barcode }}</span
									>
									<span
										v-else-if="item.barcodes && item.barcodes.length > 1"
										class="text-xs text-muted-foreground"
										>{{ item.barcodes.length }} {{ __("barcodes") }}</span
									>
									<Plus class="w-4 h-4 text-primary" />
								</div>
							</div>
						</button>
					</div>
				</div>
			</div>

			<div class="flex-1 flex flex-col min-w-0">
				<div class="flex-1 overflow-y-auto p-4 xpos-scrollbar">
					<div
						v-if="items.length === 0"
						class="flex flex-col items-center justify-center h-full text-muted-foreground"
					>
						<Barcode class="w-16 h-16 mb-4 opacity-30" />
						<p class="text-base font-medium">{{ __("No items selected") }}</p>
						<p class="text-sm mt-1">
							{{ __("Search and add items from the left panel") }}
						</p>
					</div>

					<div v-else>
						<div class="mb-3 flex items-center justify-between">
							<span class="text-sm font-medium text-foreground">
								{{ items.length }} {{ __("item(s)") }} &bull; {{ totalLabels }}
								{{ __("label(s)") }}
							</span>
						</div>

						<div class="border rounded-lg overflow-hidden">
							<table class="w-full text-sm">
								<thead class="bg-muted/50">
									<tr>
										<th class="text-start px-3 py-2 font-medium text-muted-foreground">
											{{ __("Item") }}
										</th>
										<th
											class="text-center px-3 py-2 font-medium text-muted-foreground w-56"
										>
											{{ __("Barcode") }}
										</th>
										<th
											class="text-center px-3 py-2 font-medium text-muted-foreground w-24"
										>
											{{ __("Qty") }}
										</th>
										<th
											class="text-center px-3 py-2 font-medium text-muted-foreground w-16"
										></th>
									</tr>
								</thead>
								<tbody>
									<tr
										v-for="(item, idx) in items"
										:key="idx"
										class="border-t border-border hover:bg-muted/30 transition-colors"
									>
										<td class="px-3 py-2">
											<div class="font-medium">{{ item.item_name }}</div>
											<div class="text-xs text-muted-foreground">
												{{ item.item_code }}
											</div>
										</td>
										<td class="px-3 py-2 text-center">
											<select
												v-if="item.barcodes.length"
												v-model="item.selectedBarcode"
												class="w-full h-8 px-2 text-xs font-mono border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
											>
												<option
													v-for="(bc, bidx) in item.barcodes"
													:key="bidx"
													:value="bc.barcode"
												>
													{{ bc.barcode
													}}{{ bc.barcode_type ? ` (${bc.barcode_type})` : "" }}
												</option>
												<option :value="''">
													{{ item.item_code }} ({{ __("Item Code") }})
												</option>
											</select>
											<span v-else class="font-mono text-xs">{{ item.item_code }}</span>
										</td>
										<td class="px-3 py-2">
											<div class="flex items-center justify-center gap-1">
												<button
													class="w-7 h-7 flex items-center justify-center rounded border border-border hover:bg-muted transition-colors"
													@click="decrementQty(idx)"
												>
													<Minus class="w-3 h-3" />
												</button>
												<NumberInput
													v-model="item.qty"
													:min="1"
													class="w-12 h-7 text-center text-sm border border-input rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
												/>
												<button
													class="w-7 h-7 flex items-center justify-center rounded border border-border hover:bg-muted transition-colors"
													@click="incrementQty(idx)"
												>
													<Plus class="w-3 h-3" />
												</button>
											</div>
										</td>
										<td class="px-3 py-2 text-center">
											<button
												class="text-muted-foreground hover:text-destructive transition-colors"
												@click="removeItem(idx)"
											>
												<X class="w-4 h-4" />
											</button>
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div ref="printContainer" class="hidden"></div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { call } from "@/services/api";
import { Button } from "@/components/ui/button";
import { __ } from "@/lib/translate";
import { Search, Plus, Minus, X, Printer, Trash2, Barcode } from "lucide-vue-next";
import Checkbox from "@/components/ui/checkbox/Checkbox.vue";
import { NumberInput } from "@/components/ui/number-input";
import { usePosStore } from "@/stores/posStore";

interface ItemBarcode {
	barcode: string;
	barcode_type?: string;
	uom?: string;
}

interface BarcodeItem {
	item_code: string;
	item_name: string;
	barcodes: ItemBarcode[];
	selectedBarcode: string;
	qty: number;
}

interface SearchResult {
	item_code: string;
	item_name: string;
	barcodes?: ItemBarcode[];
}

interface LabelData {
	item_code: string;
	item_name: string;
	barcode_value: string;
	barcode_uri: string;
	qrcode_uri: string;
	price: number;
	currency: string;
	uom: string;
}

const searchInput = ref<HTMLInputElement | null>(null);
const printContainer = ref<HTMLDivElement | null>(null);
const searchQuery = ref("");
const searchResults = ref<SearchResult[]>([]);
const isSearching = ref(false);
const isPrinting = ref(false);

const items = ref<BarcodeItem[]>([]);
const barcodeType = ref("code128");
const labelSize = ref("medium");
const customWidth = ref(50);
const customHeight = ref(30);
const showPrice = ref(true);
const includeQR = ref(false);

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

const totalLabels = computed(() => items.value.reduce((sum, item) => sum + (item.qty || 1), 0));

const labelDims = computed(() => {
	switch (labelSize.value) {
		case "small":
			return { w: "38mm", h: "25mm", bw: "34mm", bh: "10mm" };
		case "large":
			return { w: "60mm", h: "40mm", bw: "54mm", bh: "16mm" };
		case "custom": {
			const w = Math.max(Number(customWidth.value) || 0, 10);
			const h = Math.max(Number(customHeight.value) || 0, 10);
			const bw = Math.max(w - 6, 8);
			const bh = Math.max(Math.round(h * 0.4), 6);
			return { w: `${w}mm`, h: `${h}mm`, bw: `${bw}mm`, bh: `${bh}mm` };
		}
		default:
			return { w: "50mm", h: "30mm", bw: "44mm", bh: "12mm" };
	}
});

onMounted(() => {
	nextTick(() => searchInput.value?.focus());
});

function onSearch() {
	if (searchTimeout) clearTimeout(searchTimeout);
	searchTimeout = setTimeout(() => doSearch(), 300);
}

function onSearchEnter() {
	if (searchTimeout) clearTimeout(searchTimeout);
	doSearch();
}

async function doSearch() {
	const query = searchQuery.value.trim();
	if (!query) {
		searchResults.value = [];
		return;
	}
	isSearching.value = true;
	try {
		const result = await call<{ items: SearchResult[] }>(
			"xpos.x_pos.api.barcode_generator.search_items_for_barcode",
			{ query },
		);
		searchResults.value = result?.items || [];
	} catch {
		searchResults.value = [];
	} finally {
		isSearching.value = false;
	}
}

function addItem(item: SearchResult) {
	const existing = items.value.find((i) => i.item_code === item.item_code);
	if (existing) {
		existing.qty += 1;
		return;
	}
	const barcodes = item.barcodes || [];
	items.value.push({
		item_code: item.item_code,
		item_name: item.item_name,
		barcodes,
		selectedBarcode: barcodes.length ? barcodes[0].barcode : "",
		qty: 1,
	});
}

function selectedBarcodeType(item: BarcodeItem): string | undefined {
	const match = item.barcodes.find((b) => b.barcode === item.selectedBarcode);
	return match?.barcode_type || undefined;
}

function removeItem(idx: number) {
	items.value.splice(idx, 1);
}

function incrementQty(idx: number) {
	items.value[idx].qty = Math.max(1, (items.value[idx].qty || 1) + 1);
}

function decrementQty(idx: number) {
	items.value[idx].qty = Math.max(1, (items.value[idx].qty || 1) - 1);
}

function clearAll() {
	items.value = [];
}

async function printLabels() {
	if (items.value.length === 0) return;
	isPrinting.value = true;

	try {
		const payload = items.value.map((i) => ({
			item_code: i.item_code,
			barcode: i.selectedBarcode || undefined,
			barcode_type: selectedBarcodeType(i),
			qty: i.qty,
		}));

		const labels = await call<LabelData[]>("xpos.x_pos.api.barcode_generator.get_item_barcode_labels", {
			items: JSON.stringify(payload),
			barcode_type: barcodeType.value,
			include_qr: includeQR.value ? 1 : 0,
			pos_profile: usePosStore().profileName,
		});

		if (!labels || labels.length === 0) return;

		const dims = labelDims.value;
		let html = `<!DOCTYPE html>
                <html>
                <head>
                <meta charset="utf-8" />
                <title>Barcode Labels</title>
                <style>
                @page {
                    size: ${dims.w} ${dims.h};
                    margin: 0;
                }
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: Arial, Helvetica, sans-serif;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .label {
                    width: ${dims.w};
                    height: ${dims.h};
                    padding: 1.5mm;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    page-break-after: always;
                    overflow: hidden;
                }
                .label:last-child { page-break-after: auto; }
                .label-name {
                    font-size: 8px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: calc(${dims.w} - 4mm);
                    margin-bottom: 1mm;
                }
                .label-barcode img {
                    max-width: ${dims.bw};
                    height: ${dims.bh};
                    object-fit: contain;
                }
                .label-barcode-text {
                    font-size: 7px;
                    font-family: ui-monospace, 'SF Mono', 'JetBrains Mono', 'Roboto Mono', 'Cascadia Code', Menlo, Consolas, monospace;
                    font-variant-numeric: tabular-nums;
                    letter-spacing: 0.8px;
                    margin-top: 0.5mm;
                }
                .label-price {
                    font-size: 9px;
                    font-weight: 900;
                    margin-top: 0.5mm;
                }
                .label-qr img {
                    width: 10mm;
                    height: 10mm;
                    margin-top: 0.5mm;
                }
                @media print {
                    body { margin: 0; }
                }
                </style>
                </head>
                <body>
        `;

		for (const label of labels) {
			html += `<div class="label">`;
			html += `<div class="label-name">${escapeHtml(label.item_name)}</div>`;
			if (label.barcode_uri) {
				html += `<div class="label-barcode"><img src="${
					label.barcode_uri
				}" alt="${escapeHtml(label.barcode_value)}" /></div>`;
			}
			if (label.item_code && label.item_code !== label.barcode_value) {
				html += `<div class="label-barcode-text">${escapeHtml(label.item_code)}</div>`;
			}
			if (showPrice.value && label.price != null) {
				html += `<div class="label-price">${label.currency} ${Number(label.price).toFixed(2)}</div>`;
			}
			if (includeQR.value && label.qrcode_uri) {
				html += `<div class="label-qr"><img src="${label.qrcode_uri}" alt="QR" /></div>`;
			}
			html += `</div>`;
		}

		html += `</body></html>`;

		const printWin = window.open("", "_blank", "width=400,height=600");
		if (printWin) {
			printWin.document.write(html);
			printWin.document.close();

			printWin.onload = () => {
				setTimeout(() => {
					printWin.print();
					printWin.close();
				}, 500);
			};
			setTimeout(() => {
				try {
					printWin.print();
					printWin.close();
				} catch {
					/* already closed */
				}
			}, 3000);
		}
	} catch (err) {
		console.error("Failed to generate barcode labels:", err);
	} finally {
		isPrinting.value = false;
	}
}

function escapeHtml(str: string): string {
	const div = document.createElement("div");
	div.textContent = str;
	return div.innerHTML;
}
</script>
