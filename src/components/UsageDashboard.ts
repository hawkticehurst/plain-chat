import { Component, html, signal, config, authService } from "@lib";
import type { Signal } from "@lib";

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
  private _isLoading: Signal<boolean> = signal(false, []);
  private _recentUsage: Signal<UsageRecord[]> = signal<UsageRecord[]>([], []);
  private _dailySummary: Signal<UsageSummary[]> = signal<UsageSummary[]>(
    [],
    []
  );
  private _monthlySummary: Signal<UsageSummary[]> = signal<UsageSummary[]>(
    [],
    []
  );
  private _currentPeriod: Signal<"daily" | "monthly"> = signal<
    "daily" | "monthly"
  >("daily", []);
  private _selectedDays: Signal<number> = signal(7, []);

  constructor() {
    super();
    this._initializeComponent();
  }

  private _initializeComponent() {
    const template = html`
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
                <p class="card-value" id="total-requests">-</p>
                <p class="card-subtitle">This period</p>
              </div>
            </div>

            <div class="summary-card">
              <div class="card-icon">💬</div>
              <div class="card-content">
                <h3 class="card-title">Total Tokens</h3>
                <p class="card-value" id="total-tokens">-</p>
                <p class="card-subtitle">Used this period</p>
              </div>
            </div>

            <div class="summary-card">
              <div class="card-icon">💰</div>
              <div class="card-content">
                <h3 class="card-title">Total Cost</h3>
                <p class="card-value" id="total-cost">-</p>
                <p class="card-subtitle">This period</p>
              </div>
            </div>

            <div class="summary-card">
              <div class="card-icon">📊</div>
              <div class="card-content">
                <h3 class="card-title">Avg. Cost/Request</h3>
                <p class="card-value" id="avg-cost">-</p>
                <p class="card-subtitle">This period</p>
              </div>
            </div>
          </div>

          <!-- Period Selector -->
          <div class="period-selector">
            <div class="period-buttons">
              <button class="period-btn active" data-period="daily">
                Daily View
              </button>
              <button class="period-btn" data-period="monthly">
                Monthly View
              </button>
            </div>
            <div class="days-selector">
              <label for="days-select">Show last:</label>
              <select id="days-select" class="form-select">
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </select>
            </div>
          </div>

          <!-- Usage Chart Section -->
          <div class="chart-section">
            <h3>Usage Trends</h3>
            <div class="chart-container">
              <div class="chart-placeholder" id="usage-chart">
                <p>Usage chart will be displayed here</p>
              </div>
            </div>
          </div>

          <!-- Model Usage Breakdown -->
          <div class="model-breakdown">
            <h3>Model Usage Breakdown</h3>
            <div class="model-stats" id="model-stats">
              <p class="loading-text">Loading model statistics...</p>
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
                <tbody id="usage-table-body">
                  <tr>
                    <td colspan="5" class="loading-row">
                      Loading recent usage...
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="dashboard-actions">
            <button type="button" class="btn btn-secondary" id="refresh-btn">
              Refresh Data
            </button>
            <button type="button" class="btn btn-secondary" id="back-btn">
              Back to Chat
            </button>
          </div>

          <!-- Status Messages -->
          <div class="status-messages">
            <div class="error-message" style="display: none;"></div>
            <div class="success-message" style="display: none;"></div>
          </div>
        </div>
      </div>
    `;

    this.innerHTML = String(template);
    this._setupEventListeners();
    this._loadUsageData();
  }

  private _setupEventListeners() {
    // Period selector buttons
    const periodBtns = this.querySelectorAll(".period-btn");
    periodBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = e.target as HTMLButtonElement;
        const period = target.dataset.period as "daily" | "monthly";
        this._switchPeriod(period);
      });
    });

    // Days selector
    const daysSelect = this.querySelector("#days-select") as HTMLSelectElement;
    daysSelect.addEventListener("change", () => {
      this._selectedDays.value = parseInt(daysSelect.value);
      this._loadUsageData();
    });

    // Action buttons
    const refreshBtn = this.querySelector("#refresh-btn") as HTMLButtonElement;
    const backBtn = this.querySelector("#back-btn") as HTMLButtonElement;

    refreshBtn.addEventListener("click", () => this._loadUsageData());
    backBtn.addEventListener("click", () => this._goBack());
  }

  private _switchPeriod(period: "daily" | "monthly") {
    this._currentPeriod.value = period;

    // Update active button
    const periodBtns = this.querySelectorAll(".period-btn");
    periodBtns.forEach((btn) => btn.classList.remove("active"));

    const activeBtn = this.querySelector(`[data-period="${period}"]`);
    if (activeBtn) {
      activeBtn.classList.add("active");
    }

    this._loadUsageData();
  }

  private async _loadUsageData() {
    try {
      this._isLoading.value = true;
      this._showMessage("Loading usage data...", "info");

      // Load recent usage
      const recentResponse = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/usage/recent?limit=20`
      );

      if (recentResponse.ok) {
        const recentData = await recentResponse.json();
        this._recentUsage.value = recentData.usage || [];
        this._renderRecentUsage();
      }

      // Load summary data based on current period
      const summaryEndpoint =
        this._currentPeriod.value === "daily"
          ? `/usage/daily?days=${this._selectedDays.value}`
          : `/usage/monthly?months=${Math.ceil(this._selectedDays.value / 30)}`;

      const summaryResponse = await authService.fetchWithAuth(
        `${config.apiBaseUrl}${summaryEndpoint}`
      );

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        if (this._currentPeriod.value === "daily") {
          this._dailySummary.value = summaryData.summary || [];
        } else {
          this._monthlySummary.value = summaryData.summary || [];
        }
        this._renderSummaryCards();
        this._renderModelBreakdown();
        this._renderUsageChart();
      }

      this._clearMessages();
    } catch (error: any) {
      this._showMessage(`Failed to load usage data: ${error.message}`, "error");
    } finally {
      this._isLoading.value = false;
    }
  }

  private _renderSummaryCards() {
    const currentData =
      this._currentPeriod.value === "daily"
        ? this._dailySummary.value
        : this._monthlySummary.value;

    const totals = currentData.reduce(
      (acc, item) => ({
        requests: acc.requests + item.requestCount,
        tokens: acc.tokens + item.totalTokens,
        cost: acc.cost + item.totalCost,
      }),
      { requests: 0, tokens: 0, cost: 0 }
    );

    const avgCost = totals.requests > 0 ? totals.cost / totals.requests : 0;

    // Update summary cards
    const totalRequestsEl = this.querySelector("#total-requests");
    const totalTokensEl = this.querySelector("#total-tokens");
    const totalCostEl = this.querySelector("#total-cost");
    const avgCostEl = this.querySelector("#avg-cost");

    if (totalRequestsEl)
      totalRequestsEl.textContent = this._formatNumber(totals.requests);
    if (totalTokensEl)
      totalTokensEl.textContent = this._formatNumber(totals.tokens);
    if (totalCostEl)
      totalCostEl.textContent = this._formatCurrency(totals.cost);
    if (avgCostEl) avgCostEl.textContent = this._formatCurrency(avgCost);
  }

  private _renderModelBreakdown() {
    const currentData =
      this._currentPeriod.value === "daily"
        ? this._dailySummary.value
        : this._monthlySummary.value;

    const modelStats: Record<
      string,
      { tokens: number; cost: number; requests: number }
    > = {};

    // Aggregate model usage across all periods
    currentData.forEach((item) => {
      Object.entries(item.modelUsage).forEach(([model, usage]) => {
        if (!modelStats[model]) {
          modelStats[model] = { tokens: 0, cost: 0, requests: 0 };
        }
        modelStats[model].tokens += usage.tokens;
        modelStats[model].cost += usage.cost;
        modelStats[model].requests += usage.requests;
      });
    });

    const modelStatsEl = this.querySelector("#model-stats");
    if (modelStatsEl) {
      if (Object.keys(modelStats).length === 0) {
        modelStatsEl.innerHTML =
          '<p class="no-data">No model usage data available</p>';
        return;
      }

      const sortedModels = Object.entries(modelStats)
        .sort(([, a], [, b]) => b.cost - a.cost)
        .slice(0, 10); // Show top 10 models

      const modelHtml = sortedModels
        .map(([model, stats]) => {
          const percentage =
            currentData.length > 0
              ? (stats.cost /
                  Object.values(modelStats).reduce(
                    (sum, s) => sum + s.cost,
                    0
                  )) *
                100
              : 0;

          return `
          <div class="model-stat-item">
            <div class="model-name">${this._formatModelName(model)}</div>
            <div class="model-details">
              <span class="model-cost">${this._formatCurrency(stats.cost)}</span>
              <span class="model-tokens">${this._formatNumber(stats.tokens)} tokens</span>
              <span class="model-requests">${stats.requests} requests</span>
            </div>
            <div class="model-bar">
              <div class="model-bar-fill" style="width: ${percentage}%"></div>
            </div>
          </div>
        `;
        })
        .join("");

      modelStatsEl.innerHTML = modelHtml;
    }
  }

  private _renderUsageChart() {
    const chartEl = this.querySelector("#usage-chart");
    if (!chartEl) return;

    const currentData =
      this._currentPeriod.value === "daily"
        ? this._dailySummary.value
        : this._monthlySummary.value;

    if (currentData.length === 0) {
      chartEl.innerHTML =
        '<p class="no-data">No usage data available for chart</p>';
      return;
    }

    // Simple ASCII-style chart for now (could be enhanced with a proper charting library)
    const maxCost = Math.max(...currentData.map((d) => d.totalCost));
    const chartHtml = currentData
      .slice(-14)
      .map((item) => {
        const height = maxCost > 0 ? (item.totalCost / maxCost) * 100 : 0;
        const label =
          this._currentPeriod.value === "daily"
            ? new Date(item.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : item.date;

        return `
        <div class="chart-bar" title="${label}: ${this._formatCurrency(item.totalCost)}">
          <div class="chart-bar-fill" style="height: ${height}%"></div>
          <div class="chart-bar-label">${label}</div>
        </div>
      `;
      })
      .join("");

    chartEl.innerHTML = `
      <div class="simple-chart">
        ${chartHtml}
      </div>
    `;
  }

  private _renderRecentUsage() {
    const tableBody = this.querySelector("#usage-table-body");
    if (!tableBody) return;

    if (this._recentUsage.value.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="5" class="no-data">No recent usage data</td></tr>';
      return;
    }

    const rowsHtml = this._recentUsage.value
      .map((usage) => {
        const time = new Date(usage.timestamp).toLocaleString();
        const status = usage.success
          ? '<span class="status-success">✓ Success</span>'
          : '<span class="status-error">✗ Error</span>';

        return `
        <tr>
          <td>${time}</td>
          <td>${this._formatModelName(usage.model)}</td>
          <td>${this._formatNumber(usage.totalTokens)}</td>
          <td>${this._formatCurrency(usage.cost)}</td>
          <td>${status}</td>
        </tr>
      `;
      })
      .join("");

    tableBody.innerHTML = rowsHtml;
  }

  private _formatNumber(num: number): string {
    return new Intl.NumberFormat().format(num);
  }

  private _formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
    }).format(amount);
  }

  private _formatModelName(model: string): string {
    // Convert model names to more readable format
    const parts = model.split("/");
    if (parts.length > 1) {
      const provider = parts[0];
      const modelName = parts[1];
      return `${provider.charAt(0).toUpperCase() + provider.slice(1)} ${modelName}`;
    }
    return model;
  }

  private _goBack() {
    window.location.hash = "#/";
  }

  private _showMessage(message: string, type: "success" | "error" | "info") {
    this._clearMessages();

    const errorEl = this.querySelector(".error-message") as HTMLElement;
    const successEl = this.querySelector(".success-message") as HTMLElement;

    if (type === "error") {
      errorEl.textContent = message;
      errorEl.style.display = "block";
    } else {
      successEl.textContent = message;
      successEl.style.display = "block";
      if (type === "info") {
        successEl.style.backgroundColor =
          "var(--color-info, var(--color-secondary))";
      }
    }
  }

  private _clearMessages() {
    const errorEl = this.querySelector(".error-message") as HTMLElement;
    const successEl = this.querySelector(".success-message") as HTMLElement;

    errorEl.style.display = "none";
    successEl.style.display = "none";
    successEl.style.backgroundColor = ""; // Reset to default
  }
}

if (!customElements.get("usage-dashboard")) {
  customElements.define("usage-dashboard", UsageDashboard);
}
