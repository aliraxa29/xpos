<template>
	<Transition name="fade">
		<div v-if="open" class="fixed inset-0 z-[100] flex justify-end">
			<div class="absolute inset-0 bg-black/40" @click="open = false" />
			<div
				class="relative flex h-full w-full max-w-2xl flex-col border-s border-border bg-background shadow-2xl"
			>
				<div class="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
					<div class="flex items-center gap-2">
						<div
							class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-red-600 shadow-sm"
						>
							<Bug class="h-4 w-4 text-white" />
						</div>
						<div>
							<h2 class="text-base font-semibold">{{ __("Error Inspector") }}</h2>
							<p class="text-xs text-muted-foreground">
								{{ entries.length }} {{ __("event(s)") }}
							</p>
						</div>
					</div>
					<div class="flex items-center gap-1">
						<Button variant="ghost" size="sm" class="gap-1 text-xs" @click="copyAll">
							<Copy class="h-3.5 w-3.5" /> {{ __("Copy") }}
						</Button>
						<Button variant="ghost" size="sm" class="gap-1 text-xs" @click="exportJson">
							<Download class="h-3.5 w-3.5" /> {{ __("Export") }}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							class="gap-1 text-xs text-destructive"
							@click="clearErrors"
						>
							<Trash2 class="h-3.5 w-3.5" /> {{ __("Clear") }}
						</Button>
						<Button variant="ghost" size="icon-sm" @click="open = false">
							<X class="h-5 w-5" />
						</Button>
					</div>
				</div>
				<div class="flex gap-1 border-b border-border px-3 pt-2">
					<button
						v-for="t in tabs"
						:key="t.id"
						class="rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors"
						:class="
							activeTab === t.id
								? 'bg-muted text-foreground'
								: 'text-muted-foreground hover:text-foreground'
						"
						@click="activeTab = t.id"
					>
						{{ t.label }}
					</button>
				</div>
				<div v-if="activeTab === 'events'" class="flex min-h-0 flex-1 flex-col">
					<div class="flex flex-wrap gap-1.5 border-b border-border px-4 py-2">
						<button
							v-for="src in sourceFilters"
							:key="src"
							class="rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors"
							:class="
								activeSource === src
									? 'border-primary bg-primary text-primary-foreground'
									: 'border-border text-muted-foreground hover:bg-muted'
							"
							@click="activeSource = src"
						>
							{{ src === "all" ? __("All") : src }}
						</button>
					</div>

					<div class="min-h-0 flex-1 overflow-y-auto p-3">
						<div
							v-if="filteredEntries.length === 0"
							class="flex flex-col items-center justify-center py-16 text-muted-foreground"
						>
							<ShieldCheck class="mb-3 h-12 w-12 text-emerald-400" />
							<p class="text-sm font-medium">{{ __("No errors captured") }}</p>
						</div>

						<div
							v-for="entry in filteredEntries"
							:key="entry.id"
							class="mb-2 overflow-hidden rounded-lg border border-border bg-card"
						>
							<button
								class="flex w-full items-start justify-between gap-2 px-3 py-2 text-start"
								@click="toggle(entry.id)"
							>
								<div class="flex min-w-0 items-start gap-2">
									<span
										class="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
										:class="sourceClass(entry.source)"
									>
										{{ entry.source }}
									</span>
									<div class="min-w-0">
										<p class="truncate text-sm font-medium">{{ entry.title }}</p>
										<p class="text-[11px] text-muted-foreground">
											{{ formatTime(entry.at) }}
										</p>
									</div>
								</div>
								<ChevronDown
									class="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform"
									:class="expanded.has(entry.id) ? 'rotate-180' : ''"
								/>
							</button>

							<div
								v-if="expanded.has(entry.id)"
								class="border-t border-border px-3 py-2 space-y-2"
							>
								<p class="text-xs text-foreground">{{ entry.message }}</p>

								<div
									v-if="entry.method || entry.status || entry.exceptionType"
									class="flex flex-wrap gap-1.5"
								>
									<Badge v-if="entry.status" variant="destructive" class="text-[10px]">
										{{ entry.status }}
									</Badge>
									<Badge v-if="entry.method" variant="secondary" class="text-[10px]">
										{{ entry.method }}
									</Badge>
									<Badge v-if="entry.exceptionType" variant="outline" class="text-[10px]">
										{{ entry.exceptionType }}
									</Badge>
								</div>

								<div v-if="entry.traceback">
									<p class="mb-1 text-[11px] font-semibold text-muted-foreground">
										{{ __("Traceback") }}
									</p>
									<pre
										class="max-h-64 overflow-auto rounded-md bg-muted p-2 text-[11px] leading-snug"
										>{{ entry.traceback }}</pre
									>
								</div>

								<details v-if="entry.args !== undefined">
									<summary
										class="cursor-pointer text-[11px] font-semibold text-muted-foreground"
									>
										{{ __("Request payload") }}
									</summary>
									<pre
										class="mt-1 max-h-48 overflow-auto rounded-md bg-muted p-2 text-[11px] leading-snug"
										>{{ pretty(entry.args) }}</pre
									>
								</details>

								<details v-if="entry.meta">
									<summary
										class="cursor-pointer text-[11px] font-semibold text-muted-foreground"
									>
										{{ __("Details") }}
									</summary>
									<pre
										class="mt-1 max-h-48 overflow-auto rounded-md bg-muted p-2 text-[11px] leading-snug"
										>{{ pretty(entry.meta) }}</pre
									>
								</details>

								<Button
									variant="outline"
									size="sm"
									class="gap-1 text-xs"
									@click="copyEntry(entry)"
								>
									<Copy class="h-3.5 w-3.5" /> {{ __("Copy") }}
								</Button>
							</div>
						</div>
					</div>
				</div>
				<div v-else class="flex min-h-0 flex-1 flex-col">
					<div class="flex items-center gap-2 border-b border-border px-4 py-2">
						<select
							v-model="selectedLog"
							class="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
							@change="loadLog"
						>
							<option v-for="f in logFiles" :key="f" :value="f">{{ f }}</option>
						</select>
						<Button variant="outline" size="sm" class="gap-1 text-xs" @click="refreshLogs">
							<RefreshCw class="h-3.5 w-3.5" /> {{ __("Refresh") }}
						</Button>
					</div>
					<div class="min-h-0 flex-1 overflow-auto p-3">
						<pre v-if="logContent" class="text-[11px] leading-snug">{{ logContent }}</pre>
						<p v-else class="py-16 text-center text-sm text-muted-foreground">
							{{ logFiles.length ? __("Select a log file") : __("No log files found") }}
						</p>
					</div>
				</div>
			</div>
		</div>
	</Transition>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
	entries,
	markAllSeen,
	clearErrors as clearErrorStore,
	exportErrors,
	type ErrorEntry,
	type ErrorSource,
} from "@/services/errorLog";
import { isElectron } from "@/services/electronBridge";
import { showSuccess, showError } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bug, Copy, Download, Trash2, X, ChevronDown, ShieldCheck, RefreshCw } from "lucide-vue-next";
import __ from "@/lib/translate";

const open = defineModel<boolean>("open", { default: false });

const isElectronEnv = isElectron();
const tabs = computed(() =>
	isElectronEnv
		? [
				{ id: "events" as const, label: __("Events") },
				{ id: "logs" as const, label: __("Logs") },
			]
		: [{ id: "events" as const, label: __("Events") }],
);
const activeTab = ref<"events" | "logs">("events");

const sourceFilters: (ErrorSource | "all")[] = [
	"all",
	"api",
	"sync",
	"dead-letter",
	"renderer",
	"promise",
	"main",
];
const activeSource = ref<ErrorSource | "all">("all");

const filteredEntries = computed(() =>
	activeSource.value === "all"
		? entries.value
		: entries.value.filter((e) => e.source === activeSource.value),
);

const expanded = ref<Set<string>>(new Set());
function toggle(id: string) {
	if (expanded.value.has(id)) expanded.value.delete(id);
	else expanded.value.add(id);
	expanded.value = new Set(expanded.value);
}

const SOURCE_CLASSES: Record<ErrorSource, string> = {
	api: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
	sync: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
	"dead-letter": "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
	renderer: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
	promise: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
	main: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
};
function sourceClass(source: ErrorSource): string {
	return SOURCE_CLASSES[source] ?? "bg-muted text-muted-foreground";
}

function pretty(value: unknown): string {
	try {
		if (typeof value === "string") {
			try {
				return JSON.stringify(JSON.parse(value), null, 2);
			} catch {
				return value;
			}
		}
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

function formatTime(iso: string): string {
	try {
		return new Date(iso).toLocaleString(undefined, {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	} catch {
		return iso;
	}
}

function entryText(entry: ErrorEntry): string {
	const parts = [
		`[${entry.at}] (${entry.source}) ${entry.title}`,
		entry.message && `Message: ${entry.message}`,
		entry.method && `Method: ${entry.method}`,
		entry.status != null && `Status: ${entry.status}`,
		entry.exceptionType && `Exception: ${entry.exceptionType}`,
		entry.traceback && `\nTraceback:\n${entry.traceback}`,
		entry.args !== undefined && `\nPayload:\n${pretty(entry.args)}`,
	].filter(Boolean);
	return parts.join("\n");
}

async function copy(text: string) {
	try {
		await navigator.clipboard.writeText(text);
		showSuccess(__("Copied to clipboard"));
	} catch {
		showError(__("Failed to copy"));
	}
}
function copyEntry(entry: ErrorEntry) {
	void copy(entryText(entry));
}
function copyAll() {
	void copy(filteredEntries.value.map(entryText).join("\n\n" + "=".repeat(60) + "\n\n"));
}

function exportJson() {
	try {
		const blob = new Blob([exportErrors()], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `xpos-errors-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
		a.click();
		URL.revokeObjectURL(url);
	} catch {
		showError(__("Failed to export"));
	}
}

function clearErrors() {
	clearErrorStore();
	expanded.value = new Set();
}

const logFiles = ref<string[]>([]);
const selectedLog = ref<string>("");
const logContent = ref<string>("");

async function refreshLogs() {
	if (!isElectronEnv || !window.electronAPI?.logs) return;
	logFiles.value = await window.electronAPI.logs.list();
	if (!selectedLog.value && logFiles.value.length) {
		selectedLog.value = logFiles.value[0];
	}
	await loadLog();
}
async function loadLog() {
	if (!isElectronEnv || !window.electronAPI?.logs || !selectedLog.value) {
		logContent.value = "";
		return;
	}
	logContent.value = await window.electronAPI.logs.read(selectedLog.value);
}

watch(open, (isOpen) => {
	if (isOpen) {
		markAllSeen();
		if (activeTab.value === "logs") void refreshLogs();
	}
});
watch(activeTab, (tab) => {
	if (tab === "logs" && open.value) void refreshLogs();
});

function onKeydown(e: KeyboardEvent) {
	if (e.key === "Escape" && open.value) {
		e.preventDefault();
		open.value = false;
	}
}
watch(
	open,
	(isOpen) => {
		if (isOpen) document.addEventListener("keydown", onKeydown, true);
		else document.removeEventListener("keydown", onKeydown, true);
	},
	{ immediate: true },
);
</script>
