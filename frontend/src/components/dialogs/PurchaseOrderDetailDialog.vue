<template>
	<Dialog
		:open="!!order"
		@update:open="
			(val) => {
				if (!val) emit('close');
			}
		"
	>
		<DialogContent class="max-w-2xl p-0">
			<DialogHeader class="p-6 pb-4 border-b border-border">
				<div class="flex items-center justify-between">
					<div>
						<DialogTitle class="text-lg">
							{{ order?.name }}
							<Badge v-if="order" :variant="statusVariant(order.status)" class="text-xs ms-2">
								{{ order.status }}
							</Badge>
						</DialogTitle>
						<DialogDescription>{{ __("Purchase Order Details") }}</DialogDescription>
					</div>
				</div>
			</DialogHeader>

			<div v-if="order" class="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
				<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
					<div class="space-y-1">
						<span class="text-xs text-muted-foreground uppercase tracking-wide">
							{{ __("Supplier") }}
						</span>
						<p class="font-medium text-foreground">
							{{ order.supplier_name || order.supplier }}
						</p>
					</div>
					<div class="space-y-1">
						<span class="text-xs text-muted-foreground uppercase tracking-wide">
							{{ __("Date") }}
						</span>
						<p class="font-medium text-foreground">{{ formatDate(order.transaction_date) }}</p>
					</div>
					<div class="space-y-1">
						<span class="text-xs text-muted-foreground uppercase tracking-wide">
							{{ __("Company") }}
						</span>
						<p class="font-medium text-foreground">{{ order.company }}</p>
					</div>
				</div>

				<div v-if="isLoading" class="py-8 text-center text-muted-foreground">
					{{ __("Loading items...") }}
				</div>
				<div v-else-if="order.items?.length" class="space-y-3">
					<h3 class="text-sm font-semibold text-foreground">
						{{ __("Items") }} ({{ order.items.length }})
					</h3>
					<div class="rounded-lg border border-border overflow-hidden">
						<div class="overflow-x-auto">
							<table class="w-full text-sm min-w-90">
								<thead class="bg-muted/50">
									<tr>
										<th
											class="text-start px-4 py-2.5 text-muted-foreground font-medium text-xs uppercase tracking-wide"
										>
											{{ __("Item") }}
										</th>
										<th
											class="text-end px-4 py-2.5 text-muted-foreground font-medium text-xs uppercase tracking-wide"
										>
											{{ __("Qty") }}
										</th>
										<th
											class="text-end px-4 py-2.5 text-muted-foreground font-medium text-xs uppercase tracking-wide"
										>
											{{ __("Rate") }}
										</th>
										<th
											class="text-end px-4 py-2.5 text-muted-foreground font-medium text-xs uppercase tracking-wide"
										>
											{{ __("Amount") }}
										</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-border">
									<tr
										v-for="item in order.items"
										:key="item.item_code"
										class="hover:bg-muted/30 transition-colors"
									>
										<td class="px-4 py-3">
											<div class="text-foreground font-medium">
												{{ item.item_name }}
											</div>
											<div class="text-xs text-muted-foreground">
												{{ item.item_code }}
											</div>
										</td>
										<td class="px-4 py-3 text-end text-muted-foreground">
											{{ qty(item.qty) }} {{ item.uom }}
										</td>
										<td class="px-4 py-3 text-end text-muted-foreground">
											{{ formatCurrency(item.rate) }}
										</td>
										<td class="px-4 py-3 text-end font-medium text-foreground">
											{{ formatCurrency((item.qty || 0) * (item.rate || 0)) }}
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>

					<div class="flex justify-between text-sm pt-1">
						<span class="text-muted-foreground">{{ __("Grand Total") }}</span>
						<span class="font-bold text-foreground text-base">{{
							formatCurrency(order.grand_total)
						}}</span>
					</div>
				</div>
			</div>

			<DialogFooter class="p-4 border-t border-border gap-2 sm:gap-2">
				<Button v-if="order?.docstatus === 0" variant="outline" @click="emit('edit', order!)">
					<Edit class="w-4 h-4" />
					{{ __("Edit") }}
				</Button>
				<div class="flex-1"></div>
				<Button size="sm" @click="emit('close')">{{ __("Close") }}</Button>
			</DialogFooter>
		</DialogContent>
	</Dialog>
</template>

<script setup lang="ts">
import { Edit } from "lucide-vue-next";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import __ from "@/lib/translate";
import { usePosStore } from "@/stores/posStore";
import { useMoney } from "@/composables/useMoney";
import type { PurchaseOrder } from "@/types/pos.types";

const props = defineProps<{
	order: PurchaseOrder | null;
	isLoading?: boolean;
}>();

const emit = defineEmits<{
	close: [];
	edit: [order: PurchaseOrder];
}>();

const posStore = usePosStore();
const { money, qty } = useMoney();

function formatCurrency(value: number): string {
	return money(value);
}

function formatDate(date: string): string {
	if (!date) return "-";
	return new Date(date).toLocaleDateString();
}

function statusVariant(
	status: string,
): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
	switch (status) {
		case "Completed":
			return "success";
		case "Draft":
			return "secondary";
		case "To Receive and Bill":
		case "To Receive":
		case "To Bill":
			return "warning";
		case "Cancelled":
			return "destructive";
		default:
			return "outline";
	}
}
</script>
