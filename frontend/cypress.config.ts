import { defineConfig } from "cypress";

export default defineConfig({
	e2e: {
		baseUrl: process.env.CYPRESS_BASE_URL || "http://localhost:5174",
		supportFile: "tests/e2e/support/e2e.ts",
		specPattern: "tests/e2e/specs/**/*.cy.{js,jsx,ts,tsx}",
		fixturesFolder: "tests/e2e/fixtures",
		videosFolder: "tests/e2e/videos",
		screenshotsFolder: "tests/e2e/screenshots",
		video: false,
		viewportWidth: 1440,
		viewportHeight: 900,
		defaultCommandTimeout: 8000,
		retries: { runMode: 1, openMode: 0 },
		setupNodeEvents() {},
	},
});
