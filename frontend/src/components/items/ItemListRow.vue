<template>
	<div
		class="flex items-center gap-3 p-2 rounded-lg transition-colors group border"
		:class="[
			isOutOfStock && !allowNegativeStock
				? 'cursor-not-allowed opacity-60 bg-muted/30 border-border'
				: highlighted
					? 'cursor-pointer bg-orange-50 dark:bg-orange-500/10 border-orange-400 dark:border-orange-500 ring-2 ring-orange-400/50 dark:ring-orange-500/40'
					: 'cursor-pointer hover:bg-muted/50 border-transparent hover:border-border',
		]"
		@click="handleClick"
	>
		<div class="w-14 h-14 shrink-0 rounded-lg bg-muted overflow-hidden relative">
			<img
				v-if="item.image && !hideImages"
				:src="item.image"
				:alt="item.item_name"
				class="w-full h-full object-cover"
				loading="lazy"
			/>
			<div v-else class="w-full h-full flex items-center justify-center">
				<Package class="w-6 h-6 text-muted-foreground/40" />
			</div>

			<div
				v-if="isOutOfStock && !allowNegativeStock"
				class="absolute inset-0 bg-background/70 flex items-center justify-center"
			>
				<AlertCircle class="w-5 h-5 text-destructive" />
			</div>
		</div>

		<div class="flex-1 min-w-0">
			<p class="text-sm font-medium text-foreground truncate">
				{{ item.item_name }}
			</p>
			<div class="flex items-center gap-2 text-xs text-muted-foreground">
				<span v-if="showItemCode" class="font-mono truncate">{{ item.item_code }}</span>
				<span v-if="showItemCode && item.item_group" class="hidden sm:inline">•</span>
				<span class="truncate">{{ item.item_group }}</span>
			</div>
		</div>

		<TooltipWrapper
			v-if="showStock && !isNonStockItem && item.actual_qty !== undefined"
			:content="String(isOutOfStock ? __('Out of Stock') : item.actual_qty)"
		>
			<Badge :variant="stockVariant" class="shrink-0 text-[10px]">
				<template v-if="isOutOfStock">
					<AlertCircle class="w-3 h-3 me-1" />
					{{ __("Out of Stock") }}
				</template>
				<template v-else>
					{{ stockLabel }}
				</template>
			</Badge>
		</TooltipWrapper>

		<div class="shrink-0 text-end">
			<span class="text-sm font-bold text-primary tabular-nums">
				{{ currencySymbol }}{{ formatPrice(item.rate) }}
			</span>
		</div>

		<button
			class="shrink-0 w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-secondary/80"
			@click.stop="$emit('showDetail', item)"
		>
			<Info class="w-4 h-4" />
		</button>

		<div
			v-if="!isOutOfStock || allowNegativeStock"
			class="shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-opacity"
		>
			<Plus class="w-4 h-4" />
		</div>
		<div
			v-else
			class="shrink-0 w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center"
		>
			<Ban class="w-4 h-4" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { usePosStore } from "@/stores/posStore";
import { Badge } from "@/components/ui/badge";
import { TooltipWrapper } from "@/components/ui/tooltip";
import { Package, Plus, AlertCircle, Ban, Info } from "lucide-vue-next";
import __ from "@/lib/translate";

const props = defineProps({
	item: { type: Object, required: true },
	currencySymbol: { type: String, default: "$" },
	highlighted: { type: Boolean, default: false },
});

const emit = defineEmits(["click", "showDetail"]);

const posStore = usePosStore();

const showStock = computed(() => posStore.displayItemsInStock);
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
	return "success" as const;
});

const stockLabel = computed(() => {
	const qty = props.item.actual_qty || 0;
	if (qty <= 0) return "Out";
	return qty > 999 ? "999+" : qty;
});

function handleClick() {
	if (isOutOfStock.value && !allowNegativeStock.value) {
		return;
	}
	emit("click", props.item);
}

function formatPrice(price: number | string) {
	return parseFloat(String(price) || "0").toFixed(2);
}
</script>
