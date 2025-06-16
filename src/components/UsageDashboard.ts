import {
  Component,
  html,
  signal,
  effect,
  computed,
  config,
  authService,
} from "@lib";
import "./UsageDashboard.css";

interface UsageRecord {
  _id: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: number;
  success: boolean;
  errorMessage?: string;
  requestId?: string;
}

interface UsageSummary {
  _id: string;
  date: string;
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  modelUsage: Record<
    string,
    { tokens: number; cost: number; requests: number }
  >;
}

export class UsageDashboard extends Component {
  // Private reactive state using signals
  #isLoading = signal<boolean>(false);
  #recentUsage = signal<UsageRecord[]>([]);
  #dailySummary = signal<UsageSummary[]>([]);
  #monthlySummary = signal<UsageSummary[]>([]);
  #currentPeriod = signal<"daily" | "monthly">("daily");
  #selectedDays = signal<number>(7);

  // DOM references
  #summaryCards: HTMLElement | null = null;
  #periodButtons: HTMLElement | null = null;
  #daysSelect: HTMLSelectElement | null = null;
  #modelStats: HTMLElement | null = null;
  #usageTableBody: HTMLElement | null = null;

  // Computed values
  #currentSummary = computed(() => {
    const period = this.#currentPeriod();
    return period === "daily" ? this.#dailySummary() : this.#monthlySummary();
  });

  #totalStats = computed(() => {
    const summary = this.#currentSummary();
    const totalRequests = summary.reduce((sum, s) => sum + s.requestCount, 0);
    const totalTokens = summary.reduce((sum, s) => sum + s.totalTokens, 0);
    const totalCost = summary.reduce((sum, s) => sum + s.totalCost, 0);
    const avgCost = totalRequests > 0 ? totalCost / totalRequests : 0;

    return {
      totalRequests,
      totalTokens,
      totalCost,
      avgCost,
    };
  });

  init() {
    // Build the DOM structure once
    this.append(html`
      <div class="usage-dashboard">
        <div class="usage-header">
          <h2>Usage Dashboard</h2>
          <p class="usage-description">
            Monitor your AI usage, costs, and performance statistics
          </p>
        </div>

        <div class="usage-content">
          <!-- Summary Cards -->
          <div class="summary-cards">
            <div class="summary-card">
              <div class="card-icon">🎯</div>
              <div class="card-content">
                <h3 class="card-title">Total Requests</h3>
                <p class="card-value" data-stat="requests">-</p>
                <p class="card-subtitle">This period</p>
              </div>
            </div>

            <div class="summary-card">
              <div class="card-icon">💬</div>
              <div class="card-content">
                <h3 class="card-title">Total Tokens</h3>
                <p class="card-value" data-stat="tokens">-</p>
                <p class="card-subtitle">Used this period</p>
              </div>
            </div>

            <div class="summary-card">
              <div class="card-icon">💰</div>
              <div class="card-content">
                <h3 class="card-title">Total Cost</h3>
                <p class="card-value" data-stat="cost">-</p>
                <p class="card-subtitle">This period</p>
              </div>
            </div>

            <div class="summary-card">
              <div class="card-icon">📊</div>
              <div class="card-content">
                <h3 class="card-title">Avg. Cost/Request</h3>
                <p class="card-value" data-stat="avgCost">-</p>
                <p class="card-subtitle">This period</p>
              </div>
            </div>
          </div>

          <!-- Period Selector -->
          <div class="period-selector">
            <div class="period-buttons">
              <button
                class="period-btn"
                data-period="daily"
                @click="handlePeriodChange"
              >
                Daily View
              </button>
              <button
                class="period-btn"
                data-period="monthly"
                @click="handlePeriodChange"
              >
                Monthly View
              </button>
            </div>
            <div class="days-selector">
              <label for="days-select">Show last:</label>
              <select
                id="days-select"
                class="form-select"
                @change="handleDaysChange"
              >
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </select>
            </div>
          </div>

          <!-- Model Usage Breakdown -->
          <div class="model-breakdown">
            <h3>Model Usage Breakdown</h3>
            <div class="model-stats">
              <!-- Model stats will be populated by reactive effects -->
            </div>
          </div>

          <!-- Recent Usage Table -->
          <div class="recent-usage">
            <h3>Recent Usage</h3>
            <div class="table-container">
              <table class="usage-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Model</th>
                    <th>Tokens</th>
                    <th>Cost</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody class="usage-table-body">
                  <!-- Usage data will be populated by reactive effects -->
                </tbody>
              </table>
            </div>
          </div>

          <!-- Back Button -->
          <div class="dashboard-actions">
            <button class="btn btn-secondary" @click="goBack">
              Back to Chat
            </button>
            <button class="btn btn-primary" @click="refreshData">
              Refresh Data
            </button>
          </div>
        </div>
      </div>
    `);

    // Cache DOM references
    this.#summaryCards = this.querySelector(".summary-cards") as HTMLElement;
    this.#periodButtons = this.querySelector(".period-buttons") as HTMLElement;
    this.#daysSelect = this.querySelector("#days-select") as HTMLSelectElement;
    this.#modelStats = this.querySelector(".model-stats") as HTMLElement;
    this.#usageTableBody = this.querySelector(
      ".usage-table-body"
    ) as HTMLElement;

    // Wire up reactive effects
    this.#setupReactiveEffects();

    // Load initial data after auth is ready
    this.#loadInitialData();
  }

  async #loadInitialData() {
    // If auth is already ready, load immediately
    if (authService.isReady() && authService.isSignedIn()) {
      this.#loadUsageData();
      return;
    }

    // Wait for auth service to be ready
    const isReady = await authService.waitForReady(10000);
    if (!isReady) {
      console.error("Authentication service failed to initialize");
      return;
    }

    // Check if user is signed in
    if (!authService.isSignedIn()) {
      console.error("User not signed in");
      return;
    }

    // Load usage data
    this.#loadUsageData();
  }

  #setupReactiveEffects() {
    // Update summary cards when stats change
    effect(() => {
      const stats = this.#totalStats();
      this.#updateSummaryCards(stats);
    });

    // Update period button states
    effect(() => {
      const currentPeriod = this.#currentPeriod();
      this.#updatePeriodButtons(currentPeriod);
    });

    // Update model breakdown when summary changes
    effect(() => {
      const summary = this.#currentSummary();
      this.#updateModelBreakdown(summary);
    });

    // Update recent usage table
    effect(() => {
      const recentUsage = this.#recentUsage();
      this.#updateUsageTable(recentUsage);
    });

    // Update days selector
    effect(() => {
      const selectedDays = this.#selectedDays();
      if (this.#daysSelect) {
        this.#daysSelect.value = selectedDays.toString();
      }
    });
  }

  #updateSummaryCards(stats: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    avgCost: number;
  }) {
    if (!this.#summaryCards) return;

    const requestsEl = this.#summaryCards.querySelector(
      '[data-stat="requests"]'
    ) as HTMLElement;
    const tokensEl = this.#summaryCards.querySelector(
      '[data-stat="tokens"]'
    ) as HTMLElement;
    const costEl = this.#summaryCards.querySelector(
      '[data-stat="cost"]'
    ) as HTMLElement;
    const avgCostEl = this.#summaryCards.querySelector(
      '[data-stat="avgCost"]'
    ) as HTMLElement;

    if (requestsEl)
      requestsEl.textContent = stats.totalRequests.toLocaleString();
    if (tokensEl) tokensEl.textContent = stats.totalTokens.toLocaleString();
    if (costEl) costEl.textContent = `$${stats.totalCost.toFixed(4)}`;
    if (avgCostEl) avgCostEl.textContent = `$${stats.avgCost.toFixed(4)}`;
  }

  #updatePeriodButtons(currentPeriod: string) {
    if (!this.#periodButtons) return;

    const buttons = this.#periodButtons.querySelectorAll(".period-btn");
    buttons.forEach((btn) => {
      const button = btn as HTMLButtonElement;
      const period = button.getAttribute("data-period");
      button.classList.toggle("active", period === currentPeriod);
    });
  }

  #updateModelBreakdown(summary: UsageSummary[]) {
    if (!this.#modelStats) return;

    if (summary.length === 0) {
      this.#modelStats.innerHTML =
        '<p class="loading-text">No usage data available</p>';
      return;
    }

    // Aggregate model usage across all periods
    const modelTotals: Record<
      string,
      { tokens: number; cost: number; requests: number }
    > = {};

    summary.forEach((s) => {
      Object.entries(s.modelUsage).forEach(([model, usage]) => {
        if (!modelTotals[model]) {
          modelTotals[model] = { tokens: 0, cost: 0, requests: 0 };
        }
        modelTotals[model].tokens += usage.tokens;
        modelTotals[model].cost += usage.cost;
        modelTotals[model].requests += usage.requests;
      });
    });

    const modelEntries = Object.entries(modelTotals)
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 5); // Show top 5 models

    if (modelEntries.length === 0) {
      this.#modelStats.innerHTML =
        '<p class="loading-text">No model usage data available</p>';
      return;
    }

    this.#modelStats.innerHTML = modelEntries
      .map(
        ([model, usage]) => `
        <div class="model-stat">
          <div class="model-name">${this.#escapeHtml(model)}</div>
          <div class="model-details">
            <span class="model-tokens">${usage.tokens.toLocaleString()} tokens</span>
            <span class="model-cost">$${usage.cost.toFixed(4)}</span>
            <span class="model-requests">${usage.requests} requests</span>
          </div>
        </div>
      `
      )
      .join("");
  }

  #updateUsageTable(recentUsage: UsageRecord[]) {
    if (!this.#usageTableBody) return;

    if (this.#isLoading()) {
      this.#usageTableBody.innerHTML =
        '<tr><td colspan="5" class="loading-row">Loading recent usage...</td></tr>';
      return;
    }

    if (recentUsage.length === 0) {
      this.#usageTableBody.innerHTML =
        '<tr><td colspan="5" class="empty-row">No recent usage data</td></tr>';
      return;
    }

    this.#usageTableBody.innerHTML = recentUsage
      .slice(0, 20) // Show only recent 20 records
      .map(
        (record) => `
        <tr class="${record.success ? "success" : "error"}">
          <td>${new Date(record.timestamp).toLocaleString()}</td>
          <td>${this.#escapeHtml(record.model)}</td>
          <td>${record.totalTokens.toLocaleString()}</td>
          <td>$${record.cost.toFixed(4)}</td>
          <td>
            <span class="status-badge ${record.success ? "success" : "error"}">
              ${record.success ? "Success" : "Error"}
            </span>
          </td>
        </tr>
      `
      )
      .join("");
  }

  // Event handlers
  handlePeriodChange = (event: Event) => {
    const target = event.target as HTMLButtonElement;
    const period = target.getAttribute("data-period") as "daily" | "monthly";
    this.#currentPeriod(period);
    this.#loadUsageData();
  };

  handleDaysChange = (event: Event) => {
    const target = event.target as HTMLSelectElement;
    this.#selectedDays(parseInt(target.value));
    this.#loadUsageData();
  };

  goBack = () => {
    window.location.hash = "#/";
  };

  refreshData = () => {
    this.#loadUsageData();
  };

  async #loadUsageData() {
    try {
      this.#isLoading(true);

      const period = this.#currentPeriod();
      const days = this.#selectedDays();

      // Load summary data - use correct endpoint based on period
      const endpoint = period === "daily" ? "daily" : "monthly";
      const summaryResponse = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/usage/${endpoint}?days=${days}`
      );

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        if (period === "daily") {
          this.#dailySummary(summaryData.summary || []);
        } else {
          this.#monthlySummary(summaryData.summary || []);
        }
      }

      // Load recent usage
      const recentResponse = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/usage/recent?limit=20`
      );

      if (recentResponse.ok) {
        const recentData = await recentResponse.json();
        this.#recentUsage(recentData.usage || []);
      }
    } catch (error) {
      console.error("Failed to load usage data:", error);
    } finally {
      this.#isLoading(false);
    }
  }

  #escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

if (!customElements.get("usage-dashboard")) {
  customElements.define("usage-dashboard", UsageDashboard);
}
