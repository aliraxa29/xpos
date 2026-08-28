<template>
	<Card
		class="group relative overflow-hidden select-none transition-all duration-200"
		:class="[
			isOutOfStock && !allowNegativeStock
				? 'cursor-not-allowed opacity-60 grayscale-[30%]'
				: highlighted
					? 'cursor-pointer shadow-md border-orange-400 ring-2 ring-orange-400/50 -translate-y-0.5 bg-orange-50/50 dark:bg-orange-500/10 dark:border-orange-500 dark:ring-orange-500/40'
					: 'cursor-pointer hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 dark:border-border dark:hover:border-primary/50',
		]"
		@click="handleClick"
	>
		<div class="relative aspect-[4/3] bg-muted overflow-hidden rounded-t-xl">
			<img
				v-if="item.image && !hideImages"
				:src="item.image"
				:alt="item.item_name"
				class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
				loading="lazy"
			/>
			<div
				v-else
				class="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50"
			>
				<Package class="w-10 h-10 text-muted-foreground/40" />
			</div>

			<Badge
				v-if="showStock && !isNonStockItem && item.actual_qty !== undefined"
				:variant="stockVariant"
				class="absolute top-2 end-2 text-[10px]"
			>
				{{ stockLabel }}
			</Badge>

			<div
				v-if="isOutOfStock && !allowNegativeStock"
				class="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center"
			>
				<div
					class="bg-destructive/90 text-destructive-foreground px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5"
				>
					<AlertCircle class="w-3.5 h-3.5" />
					{{ __("Out of Stock") }}
				</div>
			</div>

			<div
				class="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-all duration-300 flex items-center justify-center gap-2"
			>
				<div
					v-if="!isOutOfStock || allowNegativeStock"
					class="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 shadow-lg"
				>
					<Plus class="w-5 h-5" />
				</div>
				<div
					class="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 shadow-lg delay-75"
					@click.stop="$emit('showDetail', item)"
				>
					<Info class="w-5 h-5" />
				</div>
			</div>
		</div>

		<CardContent class="p-2.5">
			<p class="text-xs font-medium text-foreground leading-tight line-clamp-2 mb-1">
				{{ item.item_name }}
			</p>
			<p v-if="showItemCode" class="text-[10px] text-muted-foreground mb-1 truncate font-mono">
				{{ item.item_code }}
			</p>
			<div class="flex items-center justify-between">
				<span class="text-sm font-bold text-primary dark:text-primary-foreground tabular-nums">
					{{ money(item.rate) }}
				</span>
				<span class="text-[10px] text-muted-foreground dark:text-muted-foreground/90 truncate ms-1">
					{{ item.item_group }}
				</span>
			</div>
		</CardContent>
	</Card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { usePosStore } from "@/stores/posStore";
import { useMoney } from "@/composables/useMoney";
import { formatQty } from "@/utils/numberFormat";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, Info, AlertCircle } from "lucide-vue-next";
import __ from "@/lib/translate";

const props = defineProps({
	item: { type: Object, required: true },
	currencySymbol: { type: String, default: "$" },
	highlighted: { type: Boolean, default: false },
});

const emit = defineEmits(["click", "showDetail"]);

const posStore = usePosStore();
const { money } = useMoney();

const showStock = computed(() => true);
const showItemCode = computed(() => posStore.displayItemCode);
const allowNegativeStock = computed(() => posStore.stockSettings?.allow_negative_stock);
const hideImages = computed(() => posStore.hideImages);

const isNonStockItem = computed(() => Number(props.item.is_stock_item) === 0);

const isOutOfStock = computed(() => {
	if (isNonStockItem.value) return false;
	const qty = props.item.actual_qty;
	return qty !== undefined && qty <= 0;
});

const stockVariant = computed(() => {
	const qty = props.item.actual_qty || 0;
	if (qty <= 0) return "destructive" as const;
	if (qty <= 5) return "warning" as const;
	return "secondary" as const;
});

const stockLabel = computed(() => {
	const stock = props.item.actual_qty || 0;
	if (stock <= 0) return "Out";
	return stock > 999 ? "999+" : formatQty(stock);
});

function handleClick() {
	if (isOutOfStock.value && !allowNegativeStock.value) {
		return;
	}
	emit("click", props.item);
}
</script>
