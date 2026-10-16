// public/js/hostelMap.js
// Airline Seat Booking Style — Hostel Room Allocation Map
// 8 floors × 25 suites per floor (50 rooms) per hostel
// Each suite = 2 rooms + 1 shared washroom (capacity 4 students)

export class HostelMap {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = {
      interactive: true,
      maxPreferences: 3,
      onPreferencesChange: null,
      selectedPreferences: [],
      ...options
    };
    this.hostelData = null;
    this.activeFloor = 1;
    this.wingFilter = 'all'; // 'all', 'west', 'east'
  }

  async loadHostel(hostelName) {
    this.container.innerHTML = `
      <div class="airline-loading">
        <div class="airline-loading-plane">✈</div>
        <div class="airline-loading-text">Loading ${hostelName} layout...</div>
        <div class="airline-loading-bar"><div class="airline-loading-fill"></div></div>
      </div>
    `;

    try {
      const res = await fetch(`/api/allocation/hostel-map/${encodeURIComponent(hostelName)}`);
      this.hostelData = await res.json();
      this.activeFloor = 1;
      this.wingFilter = 'all';
      this.render();
    } catch (err) {
      this.container.innerHTML = `<div class="error-msg">Failed to load hostel map: ${err.message}</div>`;
    }
  }

  setPreferences(preferences) {
    this.options.selectedPreferences = [...preferences];
    this.render();
  }

  handleRoomPairClick(rp) {
    if (!this.options.interactive) return;
    if (rp.status === 'ALLOCATED') return;

    const existingIndex = this.options.selectedPreferences.findIndex(p => p.roomPairId === rp.id);

    if (existingIndex >= 0) {
      this.options.selectedPreferences.splice(existingIndex, 1);
      this.options.selectedPreferences.forEach((p, idx) => p.rank = idx + 1);
    } else {
      if (this.options.selectedPreferences.length >= this.options.maxPreferences) {
        // Flash the dock to indicate max reached
        const dock = this.container.querySelector('.airline-dock');
        if (dock) {
          dock.classList.add('shake');
          setTimeout(() => dock.classList.remove('shake'), 500);
        }
        return;
      }
      const nextRank = this.options.selectedPreferences.length + 1;
      this.options.selectedPreferences.push({
        rank: nextRank,
        roomPairId: rp.id,
        roomPairNumber: rp.pairNumber,
        hostelName: rp.hostelName
      });
    }

    if (this.options.onPreferencesChange) {
      this.options.onPreferencesChange(this.options.selectedPreferences);
    }

    this.render();
  }

  getFloorStats(floorPairs) {
    const total = floorPairs.length;
    const available = floorPairs.filter(rp => rp.status === 'AVAILABLE').length;
    const allocated = total - available;
    return { total, available, allocated };
  }

  render() {
    if (!this.hostelData) return;

    const { hostelName, floors, totalPairs, availablePairs } = this.hostelData;
    const floorNumbers = Object.keys(floors).map(Number).sort((a, b) => a - b);
    
    if (floorNumbers.length === 0) {
      this.container.innerHTML = `<div class="empty-state">No rooms configured in this hostel.</div>`;
      return;
    }

    // Ensure active floor is valid
    if (!floorNumbers.includes(this.activeFloor)) {
      this.activeFloor = floorNumbers[0];
    }

    const currentFloorPairs = floors[this.activeFloor] || [];
    const floorStats = this.getFloorStats(currentFloorPairs);

    // Filter by wing
    let displayPairs = currentFloorPairs;
    if (this.wingFilter === 'west') {
      displayPairs = currentFloorPairs.filter(rp => rp.wing === 'West Wing');
    } else if (this.wingFilter === 'east') {
      displayPairs = currentFloorPairs.filter(rp => rp.wing === 'East Wing');
    }

    // Sort pairs by room number
    displayPairs.sort((a, b) => parseInt(a.room1) - parseInt(b.room1));

    // Split into left wing (west) and right wing (east) for cabin layout
    const westPairs = displayPairs.filter(rp => rp.wing === 'West Wing');
    const eastPairs = displayPairs.filter(rp => rp.wing === 'East Wing');

    const html = `
      <div class="airline-container">
        <!-- Flight Deck Header -->
        <div class="airline-flight-deck">
          <div class="flight-deck-left">
            <div class="airline-hostel-badge">
              <i class="fa-solid fa-building"></i>
              <span class="airline-hostel-name">${hostelName}</span>
            </div>
            <div class="airline-stats-row">
              <div class="airline-stat">
                <span class="airline-stat-value">${totalPairs}</span>
                <span class="airline-stat-label">Total Suites</span>
              </div>
              <div class="airline-stat available">
                <span class="airline-stat-value">${availablePairs}</span>
                <span class="airline-stat-label">Available</span>
              </div>
              <div class="airline-stat occupied">
                <span class="airline-stat-value">${totalPairs - availablePairs}</span>
                <span class="airline-stat-label">Occupied</span>
              </div>
            </div>
          </div>
          <div class="flight-deck-right">
            <div class="airline-legend">
              <div class="legend-chip available"><span class="legend-dot"></span> Available</div>
              <div class="legend-chip pref1"><span class="legend-dot"></span> 1st Choice</div>
              <div class="legend-chip pref2"><span class="legend-dot"></span> 2nd Choice</div>
              <div class="legend-chip pref3"><span class="legend-dot"></span> 3rd Choice</div>
              <div class="legend-chip occupied"><span class="legend-dot"></span> Occupied</div>
            </div>
          </div>
        </div>

        <!-- Floor Elevator Selector -->
        <div class="airline-floor-selector">
          <div class="floor-selector-label">
            <i class="fa-solid fa-elevator"></i> SELECT FLOOR
          </div>
          <div class="floor-tabs" id="airline-floor-tabs">
            ${floorNumbers.map(fn => {
              const fStats = this.getFloorStats(floors[fn] || []);
              const isActive = fn === this.activeFloor;
              return `
                <button class="floor-tab ${isActive ? 'active' : ''}" data-floor="${fn}">
                  <span class="floor-tab-number">${fn}</span>
                  <span class="floor-tab-label">Floor ${fn}</span>
                  <span class="floor-tab-avail ${fStats.available === 0 ? 'full' : ''}">${fStats.available} free</span>
                </button>
              `;
            }).join('')}
          </div>
          <div class="wing-filter-group">
            <button class="wing-btn ${this.wingFilter === 'all' ? 'active' : ''}" data-wing="all">All Rooms</button>
            <button class="wing-btn ${this.wingFilter === 'west' ? 'active' : ''}" data-wing="west">
              <i class="fa-solid fa-arrow-left"></i> West Wing (01–24)
            </button>
            <button class="wing-btn ${this.wingFilter === 'east' ? 'active' : ''}" data-wing="east">
              East Wing (25–50) <i class="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </div>

        <!-- Fuselage / Cabin Blueprint -->
        <div class="airline-fuselage">
          <!-- Floor info banner -->
          <div class="fuselage-floor-banner">
            <span class="ffb-left">
              <i class="fa-solid fa-layer-group"></i> Floor ${this.activeFloor}
              <span class="ffb-count">${floorStats.available} of ${floorStats.total} suites available</span>
            </span>
            <span class="ffb-right">
              ${this.wingFilter !== 'all' ? `<span class="ffb-wing-badge">${this.wingFilter === 'west' ? 'West Wing' : 'East Wing'}</span>` : ''}
              ${displayPairs.length} suites shown
            </span>
          </div>

          <!-- Amenity corridor strip -->
          <div class="amenity-corridor">
            <div class="amenity-item"><i class="fa-solid fa-elevator"></i><span>Lift</span></div>
            <div class="amenity-item"><i class="fa-solid fa-stairs"></i><span>Stairs</span></div>
            <div class="corridor-line"></div>
            <div class="amenity-item"><i class="fa-solid fa-droplet"></i><span>Water</span></div>
            <div class="amenity-item"><i class="fa-solid fa-wifi"></i><span>Wi-Fi</span></div>
            <div class="corridor-line"></div>
            <div class="amenity-item"><i class="fa-solid fa-fire-extinguisher"></i><span>Safety</span></div>
            <div class="amenity-item"><i class="fa-solid fa-stairs"></i><span>Stairs</span></div>
          </div>

          <!-- Cabin Grid -->
          <div class="cabin-grid">
            ${this.wingFilter === 'all' ? this._renderDualWingLayout(westPairs, eastPairs) : this._renderSingleWingLayout(displayPairs)}
          </div>
        </div>

        <!-- Floating Booking Dock -->
        ${this.options.interactive ? this._renderBookingDock() : ''}
      </div>
    `;

    this.container.innerHTML = html;
    this._attachListeners(floors);
  }

  _renderDualWingLayout(westPairs, eastPairs) {
    const maxRows = Math.max(westPairs.length, eastPairs.length);
    let rows = '';

    for (let i = 0; i < maxRows; i++) {
      const westRp = westPairs[i];
      const eastRp = eastPairs[i];

      rows += `<div class="cabin-row">`;
      rows += `<div class="cabin-wing west">${westRp ? this._renderSeatUnit(westRp) : '<div class="seat-empty"></div>'}</div>`;
      rows += `<div class="cabin-aisle"><div class="aisle-line"></div></div>`;
      rows += `<div class="cabin-wing east">${eastRp ? this._renderSeatUnit(eastRp) : '<div class="seat-empty"></div>'}</div>`;
      rows += `</div>`;
    }

    return rows;
  }

  _renderSingleWingLayout(pairs) {
    let rows = '';
    // Show in a 2-column grid for single wing
    for (let i = 0; i < pairs.length; i += 2) {
      rows += `<div class="cabin-row single-wing">`;
      rows += `<div class="cabin-wing">${this._renderSeatUnit(pairs[i])}</div>`;
      if (pairs[i + 1]) {
        rows += `<div class="cabin-aisle"><div class="aisle-line"></div></div>`;
        rows += `<div class="cabin-wing">${this._renderSeatUnit(pairs[i + 1])}</div>`;
      }
      rows += `</div>`;
    }
    return rows;
  }

  _renderSeatUnit(rp) {
    const pref = this.options.selectedPreferences.find(p => p.roomPairId === rp.id);
    let seatClass = 'seat-unit';
    let badgeHtml = '';
    let prefRankLabel = '';

    if (rp.status === 'ALLOCATED') {
      seatClass += ' occupied';
      badgeHtml = `<span class="seat-badge occupied"><i class="fa-solid fa-lock"></i></span>`;
    } else if (pref) {
      seatClass += ` selected pref-${pref.rank}`;
      const rankLabels = ['', '1st', '2nd', '3rd'];
      prefRankLabel = `<span class="seat-pref-rank">${rankLabels[pref.rank]}</span>`;
      badgeHtml = `<span class="seat-badge pref${pref.rank}"><i class="fa-solid fa-star"></i> ${pref.rank}</span>`;
    } else {
      seatClass += ' available';
    }

    if (this.options.interactive && rp.status !== 'ALLOCATED') {
      seatClass += ' clickable';
    }

    return `
      <div class="${seatClass}" data-rpid="${rp.id}" title="${rp.pairNumber} — ${rp.status === 'ALLOCATED' ? 'Occupied' : 'Available'} — 4 beds">
        ${badgeHtml}
        <div class="seat-rooms">
          <div class="seat-room">
            <span class="seat-room-num">${rp.room1}</span>
            <div class="seat-beds"><i class="fa-solid fa-bed"></i><i class="fa-solid fa-bed"></i></div>
          </div>
          <div class="seat-bath">
            <i class="fa-solid fa-shower"></i>
          </div>
          <div class="seat-room">
            <span class="seat-room-num">${rp.room2}</span>
            <div class="seat-beds"><i class="fa-solid fa-bed"></i><i class="fa-solid fa-bed"></i></div>
          </div>
        </div>
        <div class="seat-pair-label">${rp.pairNumber}</div>
        ${prefRankLabel}
      </div>
    `;
  }

  _renderBookingDock() {
    const prefs = this.options.selectedPreferences;
    const slots = [1, 2, 3].map(rank => {
      const p = prefs.find(pr => pr.rank === rank);
      if (p) {
        return `
          <div class="dock-slot filled pref-${rank}">
            <div class="dock-slot-rank">${rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'} Choice</div>
            <div class="dock-slot-room">
              <i class="fa-solid fa-door-closed"></i> ${p.roomPairNumber}
            </div>
            <button class="dock-slot-remove" data-remove-rank="${rank}" title="Remove this preference">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        `;
      } else {
        return `
          <div class="dock-slot empty">
            <div class="dock-slot-rank">${rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'} Choice</div>
            <div class="dock-slot-room">
              <i class="fa-solid fa-plus"></i> Click a suite
            </div>
          </div>
        `;
      }
    });

    return `
      <div class="airline-dock" id="airline-booking-dock">
        <div class="dock-inner">
          <div class="dock-title">
            <i class="fa-solid fa-ticket"></i> Your Room Preferences
            <span class="dock-subtitle">${prefs.length}/3 selected</span>
          </div>
          <div class="dock-slots">
            ${slots.join('')}
          </div>
        </div>
      </div>
    `;
  }

  _attachListeners(floors) {
    // Floor tabs
    this.container.querySelectorAll('.floor-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeFloor = parseInt(tab.getAttribute('data-floor'));
        this.render();
      });
    });

    // Wing filter buttons
    this.container.querySelectorAll('.wing-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.wingFilter = btn.getAttribute('data-wing');
        this.render();
      });
    });

    // Seat unit clicks
    if (this.options.interactive) {
      this.container.querySelectorAll('.seat-unit.clickable').forEach(seat => {
        seat.addEventListener('click', () => {
          const rpId = seat.getAttribute('data-rpid');
          const allPairs = Object.values(floors).flat();
          const rp = allPairs.find(r => r.id === rpId);
          if (rp) this.handleRoomPairClick(rp);
        });
      });
    }

    // Dock remove buttons
    this.container.querySelectorAll('.dock-slot-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const rank = parseInt(btn.getAttribute('data-remove-rank'));
        const idx = this.options.selectedPreferences.findIndex(p => p.rank === rank);
        if (idx >= 0) {
          this.options.selectedPreferences.splice(idx, 1);
          this.options.selectedPreferences.forEach((p, i) => p.rank = i + 1);
          if (this.options.onPreferencesChange) {
            this.options.onPreferencesChange(this.options.selectedPreferences);
          }
          this.render();
        }
      });
    });
  }
}
