<template>
	<Dialog
		:open="cartStore.showPaymentDialog"
		@update:open="
			(val: boolean) => {
				if (!val) close();
			}
		"
	>
		<DialogContent class="max-w-4xl h-[calc(100vh-2rem)] flex flex-col p-0 gap-0" :hide-close="true">
			<DialogHeader
				class="shrink-0 flex-row items-center justify-between space-y-0 px-5 py-3 border-b border-border"
			>
				<div class="flex items-center gap-3">
					<div
						class="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm"
					>
						<Wallet class="w-4 h-4 text-white" />
					</div>
					<div>
						<DialogTitle class="text-base">
							{{ cartStore.isReturnMode ? __("Return Payment") : __("Payment") }}
						</DialogTitle>
						<DialogDescription class="text-xs">{{ cartStore.customerName }}</DialogDescription>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<div
						v-if="customerBalance !== null && !cartStore.isReturnMode"
						class="hidden sm:flex items-center gap-2 text-[10px]"
					>
						<span
							v-if="customerBalance > 0"
							class="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium"
						>
							{{ __("Outstanding") }}: {{ posStore.currencySymbol
							}}{{ formatPrice(customerBalance) }}
						</span>
						<span
							v-if="customerCreditLimit > 0"
							class="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium"
						>
							{{ __("Credit Limit") }}: {{ posStore.currencySymbol
							}}{{ formatPrice(customerCreditLimit) }}
						</span>
					</div>
					<Badge v-if="cartStore.isReturnMode" variant="warning" class="text-[10px]">
						<RotateCcw class="w-3 h-3" /> {{ __("Return") }}
					</Badge>
					<kbd
						class="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted rounded border border-border"
						>Esc</kbd
					>
					<Button variant="ghost" size="icon-sm" @click="close" tabindex="-1">
						<X class="w-5 h-5" />
					</Button>
				</div>
			</DialogHeader>

			<div class="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
				<div class="flex-1 flex flex-col p-4 gap-3 min-w-0 overflow-y-auto xpos-scrollbar">
					<div
						class="rounded-xl border"
						:class="
							cartStore.isReturnMode
								? 'bg-amber-500/5 border-amber-500/10'
								: 'bg-primary/5 border-primary/10'
						"
					>
						<div class="text-center py-3">
							<p
								class="text-xs font-medium mb-0.5"
								:class="cartStore.isReturnMode ? 'text-amber-600' : 'text-primary/70'"
							>
								{{ cartStore.isReturnMode ? __("Refund Amount") : __("Amount Due") }}
							</p>
							<p
								class="text-3xl font-extrabold tabular-nums"
								:class="cartStore.isReturnMode ? 'text-amber-600' : 'text-primary'"
							>
								{{ posStore.currencySymbol }}{{ formatPrice(Math.abs(cartStore.grandTotal)) }}
							</p>
						</div>
						<div
							v-if="
								cartStore.calculatedTaxes.length > 0 ||
								cartStore.offerItemDiscountTotal > 0 ||
								cartStore.offerGrandTotalDiscountPct > 0 ||
								cartStore.appliedCoupon
							"
							class="px-4 pb-3 pt-1 border-t border-border/50"
						>
							<div class="flex items-center justify-between text-xs text-muted-foreground mb-1">
								<span>{{ __("Subtotal") }}</span>
								<span
									>{{ posStore.currencySymbol }}{{ formatPrice(cartStore.subtotal) }}</span
								>
							</div>
							<div
								v-for="(tax, idx) in cartStore.calculatedTaxes"
								:key="idx"
								class="flex items-center justify-between text-xs text-muted-foreground"
							>
								<span class="flex items-center gap-1">
									{{ tax.description }}
									<span class="text-[10px]">({{ tax.rate }}%)</span>
									<span
										v-if="tax.included_in_print_rate"
										class="text-[9px] text-blue-500"
										>{{ __("incl.") }}</span
									>
								</span>
								<span :class="tax.included_in_print_rate ? 'text-blue-500' : ''">
									{{ tax.included_in_print_rate ? "" : "+" }}{{ posStore.currencySymbol
									}}{{ formatPrice(tax.amount) }}
								</span>
							</div>
							<div
								v-if="cartStore.offerItemDiscountTotal > 0"
								class="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400"
							>
								<span>{{ __("Offer Discount") }}</span>
								<span
									>-{{ posStore.currencySymbol
									}}{{ formatPrice(cartStore.offerItemDiscountTotal) }}</span
								>
							</div>
							<div
								v-if="cartStore.offerGrandTotalDiscountPct > 0"
								class="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400"
							>
								<span>{{ __("Offer") }} ({{ cartStore.offerGrandTotalDiscountPct }}%)</span>
								<span
									>-{{ posStore.currencySymbol
									}}{{ formatPrice(paymentOfferGrandDiscount) }}</span
								>
							</div>
							<div
								v-if="cartStore.appliedCoupon"
								class="flex items-center justify-between text-xs text-violet-600 dark:text-violet-400"
							>
								<span
									>{{ __("Coupon") }}:
									{{
										cartStore.appliedCoupon.coupon_code || cartStore.appliedCoupon.name
									}}</span
								>
								<span class="text-[10px]">{{ __("Applied") }}</span>
							</div>
						</div>
					</div>

					<div>
						<div class="flex items-center justify-between mb-2">
							<h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								{{ __("Method") }}
							</h3>
							<div class="flex items-center gap-1">
								<kbd
									class="px-1 py-0.5 text-[9px] font-mono text-muted-foreground bg-muted rounded border border-border"
									>&larr;</kbd
								>
								<kbd
									class="px-1 py-0.5 text-[9px] font-mono text-muted-foreground bg-muted rounded border border-border"
									>&rarr;</kbd
								>
							</div>
						</div>
						<div class="flex gap-2 flex-wrap">
							<button
								v-for="(method, idx) in availableMethods"
								:key="method.mode_of_payment"
								:ref="
									(el) => {
										if (el) methodRefs[idx] = el as HTMLButtonElement;
									}
								"
								@click="selectMethod(method.mode_of_payment)"
								@keydown.left.prevent="focusMethod(idx - 1)"
								@keydown.right.prevent="focusMethod(idx + 1)"
								@keydown.down.prevent="focusAmountInput"
								class="flex-1 min-w-[80px] p-2.5 rounded-xl border-2 text-center transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring"
								:class="
									selectedMethod === method.mode_of_payment
										? 'border-primary bg-primary/5 text-primary shadow-sm'
										: 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30'
								"
							>
								<div class="text-lg mb-0.5">
									<component
										:is="getMethodIcon(method.mode_of_payment)"
										class="w-5 h-5 mx-auto"
									/>
								</div>
								<p class="text-[11px] font-medium truncate">
									{{ method.mode_of_payment }}
								</p>
							</button>
						</div>
					</div>

					<div>
						<div class="flex items-center justify-between mb-1.5">
							<label
								class="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
							>
								{{ __("Tendered") }}</label
							>
							<Button
								v-if="!isSplitPayment"
								variant="link"
								size="sm"
								class="text-xs h-auto p-0"
								@click="enableSplitPayment"
							>
								{{ __("Split Payment") }}
							</Button>
						</div>
						<NumberInput
							ref="amountInput"
							v-model="tenderedAmount"
							:min="0"
							:precision="2"
							class="text-center text-xl font-bold tracking-wider py-3"
							:select-on-focus="true"
							@keydown.enter.stop.prevent="handleAmountInputSubmit"
							@keydown.up.prevent="focusMethodByIndex"
							@keydown.down.prevent="focusFirstQuickAmount"
						/>
					</div>

					<div v-if="isSplitPayment" class="space-y-2">
						<Button
							variant="outline"
							size="sm"
							class="w-full"
							@click="addSplitPayment"
							:disabled="!selectedMethod || tenderedAmount <= 0"
						>
							<Plus class="w-4 h-4" />
							Add {{ selectedMethod }} &mdash; {{ posStore.currencySymbol
							}}{{ formatPrice(tenderedAmount) }}
						</Button>

						<div v-if="splitPayments.length > 0" class="space-y-1">
							<div
								v-for="(sp, idx) in splitPayments"
								:key="idx"
								class="flex items-center justify-between bg-muted rounded-lg px-3 py-2 text-sm"
							>
								<div class="flex items-center gap-2">
									<component :is="getMethodIcon(sp.mode_of_payment)" class="w-5 h-5" />
									<span class="font-medium text-foreground">{{ sp.mode_of_payment }}</span>
								</div>
								<div class="flex items-center gap-2">
									<span class="font-bold text-foreground"
										>{{ posStore.currencySymbol }}{{ formatPrice(sp.amount) }}</span
									>
									<button
										@click="removeSplitPayment(idx)"
										class="text-muted-foreground hover:text-destructive"
									>
										<X class="w-3.5 h-3.5" />
									</button>
								</div>
							</div>
							<div class="flex justify-between text-sm font-semibold px-3 pt-1">
								<span class="text-muted-foreground">{{ __("Total Paid") }}</span>
								<span class="text-primary"
									>{{ posStore.currencySymbol }}{{ formatPrice(splitTotal) }}</span
								>
							</div>
						</div>
					</div>

					<div v-if="!isSplitPayment" class="grid grid-cols-4 gap-1.5">
						<Button
							v-for="(amount, idx) in quickAmounts"
							:key="amount"
							:ref="
								(el) => {
									if (el) quickAmountRefs[idx] = (el as any).$el || el;
								}
							"
							variant="outline"
							size="sm"
							class="active:scale-95"
							@click="setQuickAmount(amount)"
							@keydown.enter.prevent="setQuickAmount(amount)"
							@keydown.up.prevent="focusAmountInput"
							@keydown.down.prevent="focusSubmitBtn"
							@keydown.left.prevent="focusQuickAmount(idx - 1)"
							@keydown.right.prevent="focusQuickAmount(idx + 1)"
						>
							{{ posStore.currencySymbol }}{{ amount }}
						</Button>
					</div>

					<div
						v-if="cartStore.customer && !cartStore.isReturnMode && customerLoyaltyPoints > 0"
						class="bg-violet-500/5 border border-violet-500/20 rounded-xl p-3 space-y-2"
					>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<Gift class="w-4 h-4 text-violet-500" />
								<span class="text-sm font-medium text-foreground">{{
									__("Loyalty Points")
								}}</span>
							</div>
							<Badge variant="secondary" class="text-[10px]">
								{{ customerLoyaltyPoints }} {{ __("pts") }} ({{ posStore.currencySymbol
								}}{{ formatPrice(customerLoyaltyAmount) }})
							</Badge>
						</div>

						<template v-if="cartStore.redeemLoyaltyPoints">
							<div class="flex items-center justify-between text-xs">
								<span class="text-violet-700 dark:text-violet-300 font-medium">
									{{ __("Redeeming") }}: {{ cartStore.loyaltyPoints }} {{ __("pts") }} =
									{{ posStore.currencySymbol }}{{ formatPrice(cartStore.loyaltyAmount) }}
								</span>
								<Button
									variant="ghost"
									size="sm"
									class="h-6 px-2 text-[10px] text-destructive"
									@click="
										cartStore.clearLoyalty();
										showLoyaltyInput = false;
									"
								>
									{{ __("Remove") }}
								</Button>
							</div>
						</template>

						<template v-else-if="showLoyaltyInput">
							<div class="space-y-1.5">
								<div class="flex items-center gap-1.5">
									<NumberInput
										v-model="redeemPointsInput"
										:min="1"
										:max="maxRedeemablePoints"
										:precision="0"
										class="flex-1 text-sm"
									/>
									<span class="text-xs text-muted-foreground shrink-0"
										>/ {{ maxRedeemablePoints }} {{ __("pts") }}</span
									>
								</div>
								<p class="text-[11px] text-violet-600 dark:text-violet-400">
									{{ __("Discount") }}: {{ posStore.currencySymbol
									}}{{ formatPrice(redeemInputAmount) }}
								</p>
								<div class="flex gap-1.5">
									<Button
										variant="default"
										size="sm"
										class="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-xs"
										:disabled="redeemPointsInput < 1"
										@click="applyLoyalty"
									>
										{{ __("Apply") }}
									</Button>
									<Button
										variant="outline"
										size="sm"
										class="flex-1 text-xs"
										@click="cancelLoyaltyInput"
									>
										{{ __("Cancel") }}
									</Button>
								</div>
							</div>
						</template>

						<template v-else>
							<Button
								variant="outline"
								size="sm"
								class="w-full text-violet-600 dark:hover:bg-violet-950 text-xs"
								@click="openLoyaltyInput"
							>
								<Gift class="w-3 h-3" />
								{{ __("Redeem Points") }}
							</Button>
						</template>
					</div>

					<div v-if="posStore.allowWriteOffChange && !cartStore.isReturnMode" class="space-y-1">
						<div class="flex items-center justify-between">
							<label
								class="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
							>
								{{ __("Write Off") }}
							</label>
							<span class="text-xs text-muted-foreground">{{
								__("Small remaining amounts")
							}}</span>
						</div>
						<NumberInput
							v-model="writeOffInput"
							:min="0"
							:precision="2"
							placeholder="0.00"
							class="text-sm"
							@change="cartStore.writeOffAmount = writeOffInput || 0"
						/>
					</div>

					<div class="flex gap-2 mt-auto">
						<div
							v-if="changeAmount > 0"
							class="flex-1 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 text-center"
						>
							<p class="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mb-0.5">
								{{ __("Change") }}
							</p>
							<p
								class="text-lg font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums"
							>
								{{ posStore.currencySymbol }}{{ formatPrice(changeAmount) }}
							</p>
						</div>
						<div
							v-if="remainingAmount > 0"
							class="flex-1 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-center"
						>
							<p class="text-[10px] font-medium text-amber-600 dark:text-amber-400 mb-0.5">
								{{ remainingLabel }}
							</p>
							<p class="text-lg font-extrabold text-amber-700 dark:text-amber-300 tabular-nums">
								{{ posStore.currencySymbol }}{{ formatPrice(remainingAmount) }}
							</p>
							<p
								v-if="outstandingSubmissionHint"
								class="mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400"
							>
								{{ outstandingSubmissionHint }}
							</p>
						</div>
					</div>

					<div class="space-y-1">
						<div class="flex items-center justify-between">
							<label
								class="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
							>
								{{ __("Posting Date") }}
							</label>
							<span
								v-if="!posStore.allowChangePostingDate"
								class="text-xs text-muted-foreground"
							>
								{{ __("Locked by POS Profile") }}
							</span>
						</div>
						<DateTimePicker
							v-model="cartStore.postingDate"
							mode="date"
							:disabled="!posStore.allowChangePostingDate"
							:clearable="false"
							placeholder="Posting date"
							class="text-sm"
						/>
					</div>
				</div>

				<div class="hidden lg:flex flex-col w-64 border-s border-border p-4 gap-3">
					<h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						{{ __("Numpad") }}
					</h3>
					<div class="grid grid-cols-3 gap-1.5 flex-1">
						<Button
							v-for="(key, idx) in numpadKeys"
							:key="key"
							:ref="
								(el) => {
									if (el) numpadRefs[idx] = (el as any).$el || el;
								}
							"
							:variant="key === '⌫' ? 'destructive' : key === 'C' ? 'secondary' : 'outline'"
							class="text-base h-12"
							@click="handleNumpad(key)"
							@keydown.enter.prevent="handleNumpad(key)"
						>
							<Delete v-if="key === '⌫'" class="w-5 h-5" />
							<template v-else>{{ key }}</template>
						</Button>
					</div>
				</div>
			</div>

			<DialogFooter
				class="shrink-0 border-t border-border px-5 py-3 bg-muted/30 justify-between sm:justify-between"
			>
				<div class="hidden sm:flex items-center gap-2 text-[10px] text-muted-foreground">
					<kbd class="px-1.5 py-0.5 font-mono bg-muted rounded border border-border">Enter</kbd>
					<span>{{ __("Save & Print") }}</span>
					<span class="mx-1">|</span>
					<kbd class="px-1.5 py-0.5 font-mono bg-muted rounded border border-border"
						>Ctrl+Enter</kbd
					>
					<span>{{ __("Save Only") }}</span>
					<span class="mx-1">|</span>
					<kbd class="px-1.5 py-0.5 font-mono bg-muted rounded border border-border">Esc</kbd>
					<span>{{ __("Cancel") }}</span>
				</div>
				<div class="flex items-center gap-2">
					<Button variant="outline" @click="close" tabindex="-1">{{ __("Cancel") }}</Button>
					<Button
						variant="outline"
						class="font-medium"
						:disabled="isSubmitting || !canSubmit"
						@click="submitPayment(false)"
					>
						<template v-if="isSubmitting && !printAfterSave">
							<Loader2 class="w-4 h-4 animate-spin" />
						</template>
						<template v-else>
							<Save class="w-4 h-4" />
						</template>
						{{ __("Save Only") }}
					</Button>
					<Button
						ref="submitBtn"
						:variant="cartStore.isReturnMode ? 'destructive' : 'success'"
						class="font-bold px-4 shadow-md"
						:disabled="isSubmitting || !canSubmit"
						@click="submitPayment(true)"
					>
						<template v-if="isSubmitting && printAfterSave">
							<Loader2 class="w-4 h-4 animate-spin" />
							{{ __("Processing...") }}
						</template>
						<template v-else>
							<Printer class="w-4 h-4" />
							{{ cartStore.isReturnMode ? __("Return & Print") : __("Save & Print") }}
						</template>
					</Button>
				</div>
			</DialogFooter>
		</DialogContent>
	</Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { usePosStore } from "@/stores/posStore";
import { useCartStore } from "@/stores/cartStore";
import { useAuthStore } from "@/stores/authStore";
import { usePaymentStore } from "@/stores/paymentStore";
import { call, showSuccess, showError, showInfo, isNetworkError } from "@/services/api";
import { useOfflineStore } from "@/stores/offlineStore";
import { __ } from "@/lib/translate";
import { usePrintInvoice } from "@/composables/usePrintInvoice";
import { isElectron } from "@/services/electronBridge";
import { fiscalizeViaLocalService } from "@/services/fbrLocalService";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { NumberInput } from "@/components/ui/number-input";
import { Badge } from "@/components/ui/badge";
import {
	Wallet,
	X,
	Check,
	Loader2,
	Delete,
	Gift,
	RotateCcw,
	Plus,
	Save,
	Printer,
	Banknote,
	CreditCard,
	Landmark,
	Smartphone,
	FileText,
	DollarSign,
} from "lucide-vue-next";

import type { InvoiceData, InvoicePayment } from "@/types/pos.types";
import { isOnline, extractErrorMessage } from "@/utils";
import { nowDate } from "@/utils/datetime";
import {
	isPaymentDialogSaveAndPrintShortcut,
	isPaymentDialogSaveOnlyShortcut,
} from "@/components/dialogs/paymentDialogShortcuts";

const posStore = usePosStore();
const { printInvoice, printInvoiceLocal } = usePrintInvoice();
const cartStore = useCartStore();
const authStore = useAuthStore();
const paymentStore = usePaymentStore();
const offlineStore = useOfflineStore();

const amountInput = ref<InstanceType<typeof NumberInput> | null>(null);
const submitBtn = ref<InstanceType<typeof Button> | null>(null);
const methodRefs: Record<number, HTMLButtonElement> = {};
const quickAmountRefs: Record<number, HTMLElement> = {};
const numpadRefs: Record<number, HTMLElement> = {};

const selectedMethod = ref("");
const tenderedAmount = ref(0);
const isSubmitting = ref(false);
const writeOffInput = ref(0);
const printAfterSave = ref(false);

const isSplitPayment = ref(false);
const splitPayments = ref<InvoicePayment[]>([]);

const customerLoyaltyPoints = ref(0);
const customerLoyaltyAmount = ref(0);
const customerConversionFactor = ref(1);
const customerBalance = ref<number | null>(null);
const customerCreditLimit = ref(0);

const showLoyaltyInput = ref(false);
const redeemPointsInput = ref(0);

const numpadKeys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "C", "0", "⌫"];

const availableMethods = computed(() => {
	const methods = posStore.paymentMethods;
	if (methods.length > 0) return methods;
	return [{ mode_of_payment: "Cash" }, { mode_of_payment: "Card" }];
});

const quickAmounts = computed(() => {
	const total = Math.abs(cartStore.grandTotal);
	const amounts: number[] = [];
	const rounded = Math.ceil(total);
	amounts.push(rounded);
	amounts.push(Math.ceil(total / 10) * 10);
	amounts.push(Math.ceil(total / 50) * 50);
	amounts.push(Math.ceil(total / 100) * 100);
	return [...new Set(amounts)].sort((a, b) => a - b).slice(0, 4);
});

const splitTotal = computed(() => splitPayments.value.reduce((sum, p) => sum + (p.amount || 0), 0));

const maxRedeemablePoints = computed(() => {
	const total = Math.abs(cartStore.grandTotal);
	const conversionFactor = customerConversionFactor.value || 1;
	const maxByTotal = Math.floor(total / conversionFactor);
	return Math.min(customerLoyaltyPoints.value, maxByTotal);
});

const redeemInputAmount = computed(() => {
	return redeemPointsInput.value * (customerConversionFactor.value || 1);
});

const paymentOfferGrandDiscount = computed(() => {
	if (cartStore.offerGrandTotalDiscountPct <= 0) return 0;
	const taxAmt = cartStore.calculatedTaxes
		.filter((t) => !t.included_in_print_rate)
		.reduce((s, t) => s + t.amount, 0);
	const base = cartStore.subtotal + taxAmt - cartStore.offerItemDiscountTotal;
	return (base * cartStore.offerGrandTotalDiscountPct) / 100;
});

const effectiveTendered = computed(() => (isSplitPayment.value ? splitTotal.value : tenderedAmount.value));

const changeAmount = computed(() => {
	const total = Math.abs(cartStore.grandTotal);
	const diff = roundCurrency(effectiveTendered.value - total);
	return diff > 0 ? diff : 0;
});

const remainingAmount = computed(() => {
	const total = Math.abs(cartStore.grandTotal);
	const diff = roundCurrency(total - effectiveTendered.value);
	return diff > 0 ? diff : 0;
});

const hasRecordedPayment = computed(() => {
	const amount = isSplitPayment.value ? splitTotal.value : tenderedAmount.value;
	return roundCurrency(amount) > 0;
});

const canSubmitOutstanding = computed(() => {
	if (cartStore.isReturnMode || remainingAmount.value <= 0) return false;
	if (posStore.allowCreditSale) return true;
	return hasRecordedPayment.value && posStore.allowPartialPayment;
});

const remainingLabel = computed(() => {
	return canSubmitOutstanding.value ? __("Outstanding After Save") : __("Remaining");
});

const outstandingSubmissionHint = computed(() => {
	if (!canSubmitOutstanding.value) return "";
	if (posStore.allowCreditSale) {
		return __("Invoice will be submitted with an outstanding credit balance.");
	}
	return __("Invoice will be submitted with a partial payment.");
});

const canSubmit = computed(() => {
	if (cartStore.isEmpty) return false;
	const total = roundCurrency(Math.abs(cartStore.grandTotal));
	if (total <= 0) return true;
	if (remainingAmount.value > 0) {
		return canSubmitOutstanding.value;
	}
	if (isSplitPayment.value) {
		return roundCurrency(splitTotal.value) >= total;
	}
	return selectedMethod.value !== "" && roundCurrency(tenderedAmount.value) >= total;
});

onMounted(async () => {
	if (!posStore.allowChangePostingDate || !cartStore.postingDate) {
		cartStore.postingDate = nowDate();
	}

	tenderedAmount.value = roundCurrency(Math.abs(cartStore.grandTotal));
	if (availableMethods.value.length > 0) {
		selectedMethod.value = availableMethods.value[0].mode_of_payment;
	}
	nextTick(() => {
		amountInput.value?.focus();
	});

	if (cartStore.customer) {
		try {
			const credit = await paymentStore.fetchAvailableCredit(
				cartStore.customer.name,
				posStore.companyName,
			);
			if (credit) {
				customerLoyaltyPoints.value = credit.loyalty_points || 0;
				customerLoyaltyAmount.value = credit.loyalty_amount || 0;
			}
		} catch {
			/* ignore */
		}

		try {
			const info = await call<{
				balance?: number;
				credit_limit?: number;
				loyalty_points?: number;
				loyalty_program?: { conversion_factor?: number };
			}>("xpos.api.customers.get_customer_info", { customer: cartStore.customer.name });
			if (info) {
				customerBalance.value = info.balance ?? null;
				customerCreditLimit.value = info.credit_limit ?? 0;
				if ((info.loyalty_points ?? 0) > 0) {
					const conversionFactor = info.loyalty_program?.conversion_factor || 1;
					customerLoyaltyPoints.value = info.loyalty_points!;
					customerConversionFactor.value = conversionFactor;
					customerLoyaltyAmount.value = info.loyalty_points! * conversionFactor;
				}
			}
		} catch {
			/* non-critical */
		}
	}

	document.addEventListener("keydown", handleGlobalKeydown);
});

watch(
	() => cartStore.loyaltyAmount,
	() => {
		if (!isSplitPayment.value) {
			const newTotal = roundCurrency(Math.abs(cartStore.grandTotal));
			tenderedAmount.value = newTotal;
			nextTick(() => {
				amountInput.value?.setValue(newTotal);
			});
		}
	},
);

onUnmounted(() => {
	document.removeEventListener("keydown", handleGlobalKeydown);
});

function handleAmountInputSubmit(event: KeyboardEvent) {
	if (isSubmitting.value) return;

	if (isPaymentDialogSaveOnlyShortcut(event)) {
		if (canSubmit.value) {
			submitPayment(false);
		}
		return;
	}

	if (isSplitPayment.value) {
		addSplitPayment();
		return;
	}

	if (isPaymentDialogSaveAndPrintShortcut(event) && canSubmit.value) {
		submitPayment(true);
	}
}

function handleGlobalKeydown(e: KeyboardEvent) {
	if (!cartStore.showPaymentDialog || isSubmitting.value) return;

	if (isPaymentDialogSaveOnlyShortcut(e) && canSubmit.value) {
		e.preventDefault();
		e.stopPropagation();
		submitPayment(false);
		return;
	}

	if (isPaymentDialogSaveAndPrintShortcut(e) && canSubmit.value) {
		const target = e.target as HTMLElement;
		if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
		e.preventDefault();
		e.stopPropagation();
		submitPayment(true);
	}
}

function focusMethod(idx: number) {
	const methods = availableMethods.value;
	const clamped = Math.max(0, Math.min(idx, methods.length - 1));
	methodRefs[clamped]?.focus();
	selectMethod(methods[clamped].mode_of_payment);
}

function focusMethodByIndex() {
	const currentIdx = availableMethods.value.findIndex((m) => m.mode_of_payment === selectedMethod.value);
	focusMethod(currentIdx >= 0 ? currentIdx : 0);
}

function focusAmountInput() {
	amountInput.value?.focus();
}

function focusFirstQuickAmount() {
	(quickAmountRefs[0] as HTMLElement)?.focus();
}

function focusQuickAmount(idx: number) {
	const clamped = Math.max(0, Math.min(idx, quickAmounts.value.length - 1));
	(quickAmountRefs[clamped] as HTMLElement)?.focus();
}

function focusSubmitBtn() {
	const el = submitBtn.value?.$el as HTMLElement | undefined;
	(el as HTMLButtonElement)?.focus();
}

function selectMethod(method: string) {
	selectedMethod.value = method;
}

function setQuickAmount(amount: number) {
	const rounded = roundCurrency(amount);
	tenderedAmount.value = rounded;
	setTimeout(() => {
		amountInput.value?.setValue(rounded);
	});
	focusAmountInput();
}

function enableSplitPayment() {
	isSplitPayment.value = true;
	splitPayments.value = [];
	tenderedAmount.value = 0;
}

function addSplitPayment() {
	if (!selectedMethod.value || tenderedAmount.value <= 0) return;
	const existing = splitPayments.value.find((p) => p.mode_of_payment === selectedMethod.value);
	if (existing) {
		existing.amount = roundCurrency(existing.amount + tenderedAmount.value);
	} else {
		splitPayments.value.push({
			mode_of_payment: selectedMethod.value,
			amount: roundCurrency(tenderedAmount.value),
		});
	}
	tenderedAmount.value = roundCurrency(Math.max(0, Math.abs(cartStore.grandTotal) - splitTotal.value));
}

function removeSplitPayment(idx: number) {
	splitPayments.value.splice(idx, 1);
	tenderedAmount.value = roundCurrency(Math.max(0, Math.abs(cartStore.grandTotal) - splitTotal.value));
}

function openLoyaltyInput() {
	if (maxRedeemablePoints.value <= 0) {
		showInfo(__("No redeemable loyalty points for this invoice total"));
		return;
	}
	redeemPointsInput.value = maxRedeemablePoints.value;
	showLoyaltyInput.value = true;
}

function applyLoyalty() {
	const maxPoints = maxRedeemablePoints.value;
	if (maxPoints <= 0) return;

	const points = Math.min(Math.max(Number(redeemPointsInput.value) || 0, 1), maxPoints);
	const amount = roundCurrency(points * (customerConversionFactor.value || 1));
	if (amount <= 0) return;

	cartStore.setLoyalty(points, amount);
	if (!isSplitPayment.value) {
		const newTotal = roundCurrency(Math.abs(cartStore.grandTotal));
		tenderedAmount.value = newTotal;
		nextTick(() => {
			amountInput.value?.setValue(newTotal);
		});
	}
	showLoyaltyInput.value = false;
}

function cancelLoyaltyInput() {
	showLoyaltyInput.value = false;
}

function getMethodIcon(method: string) {
	const lower = method.toLowerCase();
	if (lower.includes("cash")) return Banknote;
	if (lower.includes("card") || lower.includes("credit") || lower.includes("debit")) return CreditCard;
	if (lower.includes("bank") || lower.includes("transfer")) return Landmark;
	if (lower.includes("mobile") || lower.includes("wallet")) return Smartphone;
	if (lower.includes("check") || lower.includes("cheque")) return FileText;
	return DollarSign;
}

function handleNumpad(key: string) {
	const current = String(tenderedAmount.value || "");
	if (key === "C") {
		tenderedAmount.value = 0;
	} else if (key === "⌫") {
		tenderedAmount.value = parseFloat(current.slice(0, -1)) || 0;
	} else {
		tenderedAmount.value = parseFloat(current + key) || 0;
	}
}

function validateForSubmission(): { valid: boolean; message?: string } {
	if (cartStore.isEmpty) {
		return { valid: false, message: __("Cart is empty") };
	}

	if (!cartStore.customer?.name) {
		return { valid: false, message: __("Customer is required") };
	}

	if (cartStore.isReturnMode) {
		if (!cartStore.returnAgainst) {
			return { valid: false, message: __("Return against invoice is required for returns") };
		}

		const invalidItems = cartStore.items.filter((item) => item.qty >= 0);
		if (invalidItems.length > 0) {
			return { valid: false, message: __("Return items must have negative quantities") };
		}

		if (cartStore.grandTotal >= 0) {
			return { valid: false, message: __("Return total must be negative (refund amount)") };
		}
	} else {
		const invalidItems = cartStore.items.filter((item) => item.qty <= 0);
		if (invalidItems.length > 0) {
			return { valid: false, message: __("All items must have positive quantities") };
		}
	}

	return { valid: true };
}

function buildSubmissionPayments(): InvoicePayment[] {
	if (isSplitPayment.value) {
		return splitPayments.value
			.filter((payment) => roundCurrency(payment.amount || 0) > 0)
			.map((payment) => ({
				...payment,
				amount: roundCurrency(payment.amount || 0),
			}));
	}

	if (!selectedMethod.value || roundCurrency(tenderedAmount.value) <= 0) {
		return [];
	}

	return [
		{
			mode_of_payment: selectedMethod.value,
			amount: roundCurrency(tenderedAmount.value),
		},
	];
}

function applySubmissionPayments(invoiceData: InvoiceData): void {
	let payments = buildSubmissionPayments();

	if (cartStore.isReturnMode) {
		payments = payments.map((payment) => ({
			...payment,
			amount: -Math.abs(payment.amount),
		}));
	}

	if (payments.length > 0) {
		invoiceData.payments = payments;
	}

	if (!cartStore.isReturnMode && remainingAmount.value > 0 && posStore.allowCreditSale) {
		invoiceData.is_credit_sale = true;
	}
}

async function submitPayment(withPrint: boolean = true) {
	if (isSubmitting.value) return;

	if (showLoyaltyInput.value && !cartStore.redeemLoyaltyPoints && (redeemPointsInput.value || 0) > 0) {
		applyLoyalty();
	}

	if (!canSubmit.value) return;

	const validation = validateForSubmission();
	if (!validation.valid) {
		showError(validation.message || "Validation failed");
		return;
	}

	isSubmitting.value = true;
	printAfterSave.value = withPrint;

	try {
		const shiftName = posStore.posOpeningShift?.name || "";
		const invoiceData = cartStore.getInvoiceData(posStore.profileName, shiftName);

		applySubmissionPayments(invoiceData);

		if (changeAmount.value > 0) {
			invoiceData.change_amount = changeAmount.value;
		}

		if (isElectron() && window.electronAPI?.db) {
			const result = await window.electronAPI.db.addPendingInvoice({
				data: {
					...invoiceData,
					pos_opening_shift_local_id: shiftName,
					is_draft: false,
					is_return: cartStore.isReturnMode,
					receipt: cartStore.getReceiptSnapshot("", authStore.userFullName),
				},
				customer_name: cartStore.customerName,
				grand_total: cartStore.grandTotal,
			});

			const localId = result.id;
			posStore.lastInvoiceName = `LOCAL-${localId}`;

			if (cartStore.isReturnMode) {
				showSuccess(
					__("Return saved locally (#{0}). It will sync to server automatically.", [localId]),
				);
			} else {
				showSuccess(
					__("Invoice saved locally (#{0}). It will sync to server automatically.", [localId]),
				);
			}

			if (withPrint && localId && window.electronAPI?.print) {
				await printInvoiceLocal(localId);
			}

			cartStore.clearAll();
			return;
		}

		if (!isOnline()) {
			const result = await offlineStore.saveOffline(
				invoiceData,
				cartStore.customerName,
				cartStore.grandTotal,
			);
			if (result.success) {
				showInfo(
					__(`Invoice saved offline (#${result.localId}). It will sync when you're back online.`),
				);
				cartStore.clearAll();
			} else {
				showError(__("Failed to save invoice offline"));
			}
			return;
		}
		let result = await call<CreateInvoiceResult>("xpos.api.invoices.create_invoice", {
			data: JSON.stringify(invoiceData),
		});
		if (result.status === "fbr_local_required") {
			result = await finalizeWithLocalFbr(result);
		}

		posStore.lastInvoiceName = result.name;

		if (cartStore.isReturnMode) {
			showSuccess(__("Return {0} saved successfully!", [result.name]));
		} else {
			showSuccess(__("Invoice {0} saved successfully!", [result.name]));
		}

		if (withPrint && result.name) {
			await printInvoice(result.name);
		}

		cartStore.clearAll();
	} catch (error: unknown) {
		if (isNetworkError(error)) {
			const invoiceData = cartStore.getInvoiceData(
				posStore.profileName,
				posStore.posOpeningShift?.name || "",
			);
			applySubmissionPayments(invoiceData);
			if (changeAmount.value > 0) {
				invoiceData.change_amount = changeAmount.value;
			}
			const result = await offlineStore.saveOffline(
				invoiceData,
				cartStore.customerName,
				cartStore.grandTotal,
			);
			if (result.success) {
				showInfo(
					__(`Invoice saved offline (#${result.localId}). It will sync when you're back online.`),
				);
				cartStore.clearAll();
				return;
			}
			showError(__("You are offline. Invoice could not be saved locally."));
		} else {
			showError(__("Payment failed: {0}", [extractErrorMessage(error)]));
		}
		console.error("Payment error:", error);
	} finally {
		isSubmitting.value = false;
		printAfterSave.value = false;
	}
}

interface CreateInvoiceResult {
	name: string;
	status?: string;
	doctype?: string;
	fbr_payload?: Record<string, unknown>;
	fbr_local_service_url?: string;
}

async function finalizeWithLocalFbr(pending: CreateInvoiceResult): Promise<CreateInvoiceResult> {
	try {
		const { invoiceNumber } = await fiscalizeViaLocalService(
			pending.fbr_payload || {},
			pending.fbr_local_service_url || "",
		);
		return await call<CreateInvoiceResult>("xpos.api.invoices.finalize_fiscal_invoice", {
			name: pending.name,
			fbr_invoice_number: invoiceNumber,
			doctype: pending.doctype,
		});
	} catch (err) {
		await call("xpos.api.invoices.discard_draft_invoice", {
			name: pending.name,
			doctype: pending.doctype,
		}).catch(() => {
			/* best-effort cleanup */
		});
		throw new Error(
			__("FBR fiscalization failed — both the FBR cloud and the local service are unavailable.") +
				" " +
				extractErrorMessage(err),
		);
	}
}

function close() {
	cartStore.closePaymentDialog();
}

function roundCurrency(value: number): number {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatPrice(price: number | string) {
	return roundCurrency(parseFloat(String(price) || "0")).toFixed(2);
}
</script>
