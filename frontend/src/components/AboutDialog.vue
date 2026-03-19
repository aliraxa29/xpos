<template>
    <Dialog :open="open" @update:open="(val: boolean) => { if (!val) $emit('close') }">
        <DialogContent class="max-w-md">
            <DialogHeader>
                <DialogTitle class="flex items-center gap-3">
                    <img :src="isDark ? LogoDark : LogoLight" alt="X POS Logo" class="w-10 h-10" />
                    <span>{{ __("X POS") }}</span>
                </DialogTitle>
            </DialogHeader>

            <div class="space-y-4">
                <div class="text-center py-4">
                    <p class="text-lg font-semibold text-foreground">{{ isElectronEnv ? __("X POS Desktop") : __("X POS") }}</p>
                    <p class="text-sm text-muted-foreground">{{ __("Point of Sale Application for ERPNext") }}</p>
                </div>

                <div v-if="isLoadingInfo" class="flex justify-center py-4">
                    <Loader2 class="w-5 h-5 animate-spin text-muted-foreground" />
                </div>

                <div v-else class="space-y-4 text-sm overflow-hidden max-h-[200px]">
                    <div class="flex justify-between py-2 mr-2 border-b border-border">
                        <span class="text-muted-foreground">{{ __("Version") }}</span>
                        <span class="font-medium">{{ version }}</span>
                    </div>
                    <div v-if="gitBranch" class="flex justify-between mr-2 py-2 border-b border-border">
                        <span class="text-muted-foreground">{{ __("Branch") }}</span>
                        <span class="font-medium font-mono text-xs">{{ gitBranch }}</span>
                    </div>
                    <div v-if="gitHash" class="flex justify-between mr-2 py-2 border-b border-border">
                        <span class="text-muted-foreground">{{ __("Commit") }}</span>
                        <span class="font-medium font-mono text-xs">{{ gitHash }}</span>
                    </div>
                    <div v-if="frappeVersion" class="flex justify-between mr-2 py-2 border-b border-border">
                        <span class="text-muted-foreground">{{ __("Frappe") }}</span>
                        <span class="font-medium">{{ frappeVersion }}</span>
                    </div>
                    <div v-if="erpnextVersion" class="flex justify-between mr-2 py-2 border-b border-border">
                        <span class="text-muted-foreground">{{ __("ERPNext") }}</span>
                        <span class="font-medium">{{ erpnextVersion }}</span>
                    </div>
                    <div v-if="platformInfo" class="flex justify-between mr-2 py-2 border-b border-border">
                        <span class="text-muted-foreground">{{ __("Platform") }}</span>
                        <span class="font-medium">{{ platformInfo.platform }} ({{ platformInfo.arch }})</span>
                    </div>
                    <div class="flex justify-between mr-2 py-2 border-b border-border">
                        <span class="text-muted-foreground">{{ __("Mode") }}</span>
                        <span class="font-medium">{{ isElectronEnv ? __("Desktop App") : __("Web Browser") }}</span>
                    </div>
                    <div v-if="nodeRole" class="flex justify-between mr-2 py-2 border-b border-border">
                        <span class="text-muted-foreground">{{ __("Node Role") }}</span>
                        <Badge :variant="nodeRole === 'hub' ? 'default' : 'secondary'">
                            {{ nodeRole === 'hub' ? __('Hub') : __('Till') }}
                        </Badge>
                    </div>
                    <div v-if="pythonVersion" class="flex justify-between mr-2 py-2 border-b border-border">
                        <span class="text-muted-foreground">{{ __("Python") }}</span>
                        <span class="font-medium">{{ pythonVersion }}</span>
                    </div>
                    <div v-if="osInfo" class="flex justify-between mr-2 py-2 border-b border-border">
                        <span class="text-muted-foreground">{{ __("Server OS") }}</span>
                        <span class="font-medium">{{ osInfo }}</span>
                    </div>
                    <div v-if="siteName" class="flex justify-between mr-2 py-2 border-b border-border">
                        <span class="text-muted-foreground">{{ __("Site") }}</span>
                        <span class="font-medium">{{ siteName }}</span>
                    </div>
                    <div class="flex justify-between mr-2 py-2 border-b border-border">
                        <span class="text-muted-foreground">{{ __("Company") }}</span>
                        <span class="font-medium">{{ companyName || __("Not Set") }}</span>
                    </div>
                </div>

                <div class="pt-4 text-center text-xs text-muted-foreground">
                    <p>&copy; {{ currentYear }} {{ __("X POS Team") }}</p>
                    <p class="mt-1">{{ __("Built with Vue.js, Electron, and ERPNext") }}</p>
                </div>
            </div>

            <DialogFooter>
                <Button variant="outline" @click="$emit('close')">
                    {{ __("Close") }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup lang="ts">
import { ref, inject, watch, type Ref } from "vue";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isElectron } from "@/services/electronBridge";
import { usePosStore } from "@/stores/posStore";
import { call } from "@/services/api";
import { __ } from "@/lib/translate";
import { Loader2 } from "lucide-vue-next";

import LogoDark from "@/assets/images/xpos-logo-dark.svg";
import LogoLight from "@/assets/images/xpos-logo-light.svg";

const props = defineProps<{
    open: boolean;
}>();

defineEmits<{
    close: [];
}>();

const isDark = inject<Ref<boolean>>("isDark")!;
const posStore = usePosStore();
const isElectronEnv = isElectron();

const version = ref("0.0.1");
const gitBranch = ref("");
const gitHash = ref("");
const frappeVersion = ref("");
const erpnextVersion = ref("");
const pythonVersion = ref("");
const osInfo = ref("");
const siteName = ref("");
const platformInfo = ref<{ platform: string; arch: string } | null>(null);
const nodeRole = ref<string | null>(null);
const isLoadingInfo = ref(false);
const currentYear = new Date().getFullYear();

const companyName = posStore.companyName;

async function fetchVersionInfo() {
    isLoadingInfo.value = true;
    try {
        const info = await call<{
            xpos_version: string;
            frappe_version: string;
            erpnext_version: string;
            git_branch: string;
            git_hash: string;
            git_date: string;
            python_version: string;
            os_info: string;
            site_name: string;
        }>("xpos.api.utilities.get_version_info");

        if (info) {
            version.value = info.xpos_version || version.value;
            gitBranch.value = info.git_branch || "";
            gitHash.value = info.git_hash || "";
            frappeVersion.value = info.frappe_version || "";
            erpnextVersion.value = info.erpnext_version || "";
            pythonVersion.value = info.python_version || "";
            osInfo.value = info.os_info || "";
            siteName.value = info.site_name || "";
        }
    } catch (e) {
        console.warn("Could not fetch version info:", e);
    }

    if (isElectronEnv && window.electronAPI) {
        try {
            const info = await window.electronAPI.getPlatformInfo();
            version.value = info.version || version.value;
            platformInfo.value = { platform: info.platform, arch: info.arch };

            if (window.electronAPI.node?.getRole) {
                nodeRole.value = await window.electronAPI.node.getRole();
            }
        } catch (e) {
            console.warn("Could not get platform info:", e);
        }
    }

    isLoadingInfo.value = false;
}

watch(() => props.open, (isOpen) => {
    if (isOpen) {
        fetchVersionInfo();
    }
});
</script>
