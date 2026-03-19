<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { usePurchaseStore } from "@/stores/purchaseStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { LinkField } from "@/components/ui/link";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import type { SearchItem } from "@/types/pos.types";
import __ from "@/lib/translate";

const props = defineProps<{
    open: boolean;
    initialName?: string;
}>();

const emit = defineEmits<{
    "update:open": [value: boolean];
    created: [item: SearchItem, buyingPrice: number];
}>();

const purchaseStore = usePurchaseStore();

const newItem = ref({
    item_name: "",
    item_code: "",
    item_group: "",
    stock_uom: "Nos",
    barcode: "",
    buying_price: 0,
    selling_price: 0,
});
const isCreating = ref(false);

const dialogOpen = computed({
    get: () => props.open,
    set: (val) => emit("update:open", val),
});

watch(
    () => props.open,
    (val) => {
        if (val) {
            newItem.value = {
                item_name: props.initialName || "",
                item_code: "",
                item_group: "",
                stock_uom: "Nos",
                barcode: "",
                buying_price: 0,
                selling_price: 0,
            };
        }
    },
);

async function handleCreate(): Promise<void> {
    if (!newItem.value.item_name.trim()) return;
    isCreating.value = true;
    try {
        const created = await purchaseStore.createItem({
            item_name: newItem.value.item_name,
            item_code: newItem.value.item_code || undefined,
            item_group: newItem.value.item_group || undefined,
            stock_uom: newItem.value.stock_uom,
            barcode: newItem.value.barcode || undefined,
            buying_price: newItem.value.buying_price || undefined,
            selling_price: newItem.value.selling_price || undefined,
        });
        if (created) {
            emit("created", created, newItem.value.buying_price);
            dialogOpen.value = false;
        }
    } finally {
        isCreating.value = false;
    }
}
</script>

<template>
    <Dialog v-model:open="dialogOpen">
        <DialogContent class="max-w-lg">
            <DialogHeader>
                <DialogTitle>{{ __("Create New Item") }}</DialogTitle>
                <DialogDescription>{{ __("Add a new item to inventory") }}</DialogDescription>
            </DialogHeader>
            <form @submit.prevent="handleCreate" class="space-y-4 mt-4">
                <div class="grid grid-cols-2 gap-4">
                    <div class="col-span-2">
                        <label class="text-sm font-medium mb-1 block">{{ __("Item Name") }} *</label>
                        <Input v-model="newItem.item_name" required />
                    </div>
                    <div>
                        <label class="text-sm font-medium mb-1 block">{{ __("Item Code") }}</label>
                        <Input v-model="newItem.item_code" :placeholder="__('Auto-generated')" />
                    </div>
                    <div>
                        <label class="text-sm font-medium mb-1 block">{{ __("Barcode") }}</label>
                        <Input v-model="newItem.barcode" />
                    </div>
                    <div>
                        <label class="text-sm font-medium mb-1 block">{{ __("UOM") }}</label>
                        <LinkField v-model="newItem.stock_uom" doctype="UOM" :open-on-focus="true" />
                    </div>
                    <div>
                        <label class="text-sm font-medium mb-1 block">{{ __("Item Group") }}</label>
                        <Input v-model="newItem.item_group" />
                    </div>
                    <div>
                        <label class="text-sm font-medium mb-1 block">{{ __("Buying Price") }}</label>
                        <NumberInput v-model="newItem.buying_price" :min="0" :precision="2" />
                    </div>
                    <div>
                        <label class="text-sm font-medium mb-1 block">{{ __("Selling Price") }}</label>
                        <NumberInput v-model="newItem.selling_price" :min="0" :precision="2" />
                    </div>
                </div>
                <div class="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" @click="dialogOpen = false">
                        {{ __("Cancel") }}
                    </Button>
                    <Button type="submit" :disabled="isCreating || !newItem.item_name.trim()">
                        {{ isCreating ? __("Creating...") : __("Create") }}
                    </Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>
</template>
