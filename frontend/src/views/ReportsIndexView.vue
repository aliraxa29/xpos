<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { Search, BarChart3, ArrowRight, Lock, Sparkles, Layers3, FolderOpen } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import __ from "@/lib/translate";
import {
	getReportDefinitions,
	isReportAccessible,
	type ReportCategory,
	type ReportDefinition,
} from "@/services/reports";

const router = useRouter();
const searchTerm = ref("");

const reportDefinitions = computed(() => getReportDefinitions());

const filteredReports = computed(() => {
	const query = searchTerm.value.trim().toLowerCase();
	if (!query) return reportDefinitions.value;

	return reportDefinitions.value.filter((report) => {
		const textParts = [report.title, report.reportName, report.description, report.category, report.slug]
			.join(" ")
			.toLowerCase();
		return textParts.includes(query);
	});
});

const accessibleCount = computed(
	() => reportDefinitions.value.filter((report) => isReportAccessible(report)).length,
);

const sectionReports = computed(() => {
	const categories = Array.from(new Set(filteredReports.value.map((report) => report.category)));
	return categories.map((category) => ({
		category,
		reports: filteredReports.value.filter((report) => report.category === category),
	}));
});

const categoryAccent: Record<ReportCategory, { accent: string; chip: string; icon: string }> = {
	Inventory: {
		accent: "from-emerald-500/20 via-emerald-500/10 to-transparent",
		chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
		icon: "text-emerald-500",
	},
	Sales: {
		accent: "from-sky-500/20 via-sky-500/10 to-transparent",
		chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
		icon: "text-sky-500",
	},
	Purchasing: {
		accent: "from-amber-500/20 via-amber-500/10 to-transparent",
		chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
		icon: "text-amber-500",
	},
	Operations: {
		accent: "from-violet-500/20 via-violet-500/10 to-transparent",
		chip: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
		icon: "text-violet-500",
	},
};

function openReport(report: ReportDefinition) {
	if (!isReportAccessible(report)) return;
	router.push(`/reports/${report.slug}`);
}

function clearSearch() {
	searchTerm.value = "";
}
</script>

<template>
	<div class="flex flex-col h-full overflow-hidden bg-background">
		<div class="shrink-0 p-3 sm:p-4 pb-2 sm:pb-3">
			<Card
				class="relative overflow-hidden border-border/70 bg-gradient-to-br from-emerald-500/12 via-card to-background"
			>
				<div
					class="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.10),transparent_30%)]"
				/>
				<div class="relative p-5 sm:p-6 space-y-4">
					<div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
						<div class="space-y-2 max-w-3xl">
							<div class="flex flex-wrap items-center gap-2">
								<Badge variant="outline" class="gap-1.5 bg-background/80">
									<Layers3 class="h-3.5 w-3.5" />
									{{ __("Reports") }}
								</Badge>
								<Badge variant="secondary" class="gap-1.5">
									<BarChart3 class="h-3.5 w-3.5" />
									{{ reportDefinitions.length }} {{ __("reports") }}
								</Badge>
								<Badge variant="secondary" class="gap-1.5">
									<Sparkles class="h-3.5 w-3.5" />
									{{ accessibleCount }} {{ __("available") }}
								</Badge>
							</div>
							<h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
								{{ __("Analytics Reports") }}
							</h1>
							<p class="text-sm sm:text-base text-muted-foreground max-w-2xl">
								{{
									// prettier-ignore
									__(
										"Browse the reports library, open any report in a dedicated viewer, and export or copy the data directly from the app."
									)
								}}
							</p>
						</div>

						<div class="flex flex-wrap items-center gap-2">
							<div class="relative w-full sm:w-80">
								<Search
									class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
								/>
								<Input
									v-model="searchTerm"
									:placeholder="__('Search reports or categories...')"
									class="ps-9 h-10 bg-background/95"
								/>
							</div>
							<Button
								variant="outline"
								size="sm"
								class="h-10"
								:disabled="!searchTerm"
								@click="clearSearch"
							>
								{{ __("Clear") }}
							</Button>
						</div>
					</div>
				</div>
			</Card>
		</div>

		<ScrollArea class="flex-1 px-3 sm:px-4 pb-3 sm:pb-4">
			<div
				v-if="sectionReports.length === 0"
				class="flex flex-col items-center justify-center py-20 text-center"
			>
				<FolderOpen class="h-14 w-14 text-muted-foreground/30 mb-4" />
				<p class="text-lg font-semibold text-foreground">{{ __("No reports match your search") }}</p>
				<p class="text-sm text-muted-foreground mt-1 max-w-md">
					{{ __("Try a different keyword or clear the search field.") }}
				</p>
			</div>

			<div v-else class="space-y-8">
				<section v-for="section in sectionReports" :key="section.category" class="space-y-3">
					<div class="flex items-center justify-between gap-3">
						<div>
							<h2
								class="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground"
							>
								{{ section.category }}
							</h2>
							<p class="text-xs text-muted-foreground mt-1">
								{{ section.reports.length }} {{ __("reports") }}
							</p>
						</div>
						<Badge variant="outline" class="gap-1.5">
							<Layers3 class="h-3.5 w-3.5" />
							{{ section.category }}
						</Badge>
					</div>

					<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
						<Card
							v-for="report in section.reports"
							:key="report.slug"
							class="group relative overflow-hidden border-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
						>
							<div
								:class="[
									'absolute inset-x-0 top-0 h-1 bg-gradient-to-r',
									categoryAccent[report.category].accent,
								]"
							/>
							<div class="p-5 space-y-4">
								<div class="flex items-start justify-between gap-3">
									<div class="min-w-0 flex-1 space-y-2">
										<Badge
											:class="categoryAccent[report.category].chip"
											variant="outline"
										>
											{{ report.category }}
										</Badge>
										<h3 class="text-lg font-semibold text-foreground leading-tight">
											{{ report.title }}
										</h3>
										<p class="text-sm text-muted-foreground leading-6">
											{{ report.description }}
										</p>
									</div>
									<div
										class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-background/80"
										:class="categoryAccent[report.category].icon"
									>
										<BarChart3 class="h-5 w-5" />
									</div>
								</div>

								<div class="flex items-center justify-end gap-2 pt-1">
									<Badge
										v-if="!isReportAccessible(report)"
										variant="destructive"
										class="gap-1.5"
									>
										<Lock class="h-3 w-3" />
										{{ __("Locked") }}
									</Badge>
									<Button
										variant="outline"
										size="sm"
										class="gap-1.5"
										:disabled="!isReportAccessible(report)"
										@click="openReport(report)"
									>
										{{ __("Open") }}
										<ArrowRight class="h-4 w-4" />
									</Button>
								</div>
							</div>
						</Card>
					</div>
				</section>
			</div>
		</ScrollArea>
	</div>
</template>
