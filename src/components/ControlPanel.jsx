// ControlPanel.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import "./ControlPanel.css";
import HoloButton from "./HoloButton";

const ControlPanel = ({
  isVisible = false,
  onSatelliteSelect = null,
  onAddSatellite = null, // NEW: callback to add a searched sat into main list
  selectedSatellite = null,
  showAllSatellites = false,
  onGenerateHeatmap = null,
  satelliteData = null,
  isLoadingSatellites = false,
}) => {
  // --- animation / panel state (unchanged) ---
  const [isClosing, setIsClosing] = useState(false);
  const [animatePanel, setAnimatePanel] = useState(false);
  const [animateHeader, setAnimateHeader] = useState(false);
  const [animateBody, setAnimateBody] = useState(false);
  const [animateInner, setAnimateInner] = useState(false);

  const headerRef = useRef(null);
  const panelRef = useRef(null);
  const prevVisibleRef = useRef(isVisible);
  const openSessionRef = useRef(0);
  const panelTimerRef = useRef(null);
  const innerTimerRef = useRef(null);
  const headerEndHandlerRef = useRef(null);

  // --- search / list state ---
  const [satellitesOpen, setSatellitesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null); // null -> not searching / show main list
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // --- prepare base list from parent prop ---
  const satelliteList = useMemo(
    () => (Array.isArray(satelliteData) ? satelliteData : []),
    [satelliteData]
  );

  // which list to show: searchResults (if active) else satelliteList
  const displayedList = useMemo(
    () => (Array.isArray(searchResults) ? searchResults : satelliteList),
    [searchResults, satelliteList]
  );

  // --- selection helpers ---
  const selectedSatelliteName = useMemo(() => {
    if (!selectedSatellite) return null;
    if (typeof selectedSatellite === "string") return selectedSatellite;
    if (typeof selectedSatellite === "object" && selectedSatellite.name)
      return selectedSatellite.name;
    return null;
  }, [selectedSatellite]);

  const isSpecificSatelliteSelected = useMemo(() => {
    if (!selectedSatelliteName) return false;
    if (selectedSatellite === "ALL") return false;
    if (showAllSatellites) return false;
    return true;
  }, [selectedSatelliteName, selectedSatellite, showAllSatellites]);

  // --- animation lifecycle (unchanged) ---
  useEffect(() => {
    if (prevVisibleRef.current && !isVisible) {
      startClosingAnimation();
    } else if (!prevVisibleRef.current && isVisible) {
      startOpeningAnimation();
    }
    prevVisibleRef.current = isVisible;
    return () => cleanupListenersAndTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    const onDocPointerDown = (e) => {
      if (isClosing) return;
      const panelEl = panelRef.current;
      if (!panelEl) return;
      if (panelEl.contains(e.target)) return;
      startClosingAnimation();
    };

    document.addEventListener("mousedown", onDocPointerDown, true);
    document.addEventListener("touchstart", onDocPointerDown, true);

    return () => {
      document.removeEventListener("mousedown", onDocPointerDown, true);
      document.removeEventListener("touchstart", onDocPointerDown, true);
    };
  }, [isVisible, isClosing]);

  const cleanupListenersAndTimers = () => {
    if (panelTimerRef.current) clearTimeout(panelTimerRef.current);
    if (innerTimerRef.current) clearTimeout(innerTimerRef.current);
    const headerEl = headerRef.current;
    if (headerEl && headerEndHandlerRef.current) {
      headerEl.removeEventListener("animationend", headerEndHandlerRef.current);
    }
  };

  const startOpeningAnimation = () => {
    const session = ++openSessionRef.current;
    setIsClosing(false);
    setAnimatePanel(false);
    setAnimateHeader(false);
    setAnimateBody(false);
    setAnimateInner(false);

    requestAnimationFrame(() => {
      if (openSessionRef.current !== session) return;
      setAnimatePanel(true);

      const headerEl = headerRef.current;
      const handleHeaderAnimationEnd = (e) => {
        if (openSessionRef.current !== session) return;
        if (e.target !== headerEl) return;
        setAnimateBody(true);
        innerTimerRef.current = setTimeout(() => {
          if (openSessionRef.current !== session) return;
          setAnimateInner(true);
        }, 300);
      };

      if (headerEl && headerEndHandlerRef.current) {
        headerEl.removeEventListener(
          "animationend",
          headerEndHandlerRef.current
        );
      }
      if (headerEl) {
        headerEl.addEventListener("animationend", handleHeaderAnimationEnd);
        headerEndHandlerRef.current = handleHeaderAnimationEnd;
      }

      panelTimerRef.current = setTimeout(() => {
        if (openSessionRef.current !== session) return;
        setAnimateHeader(true);
      }, 100);
    });
  };

  const startClosingAnimation = () => {
    openSessionRef.current++;
    cleanupListenersAndTimers();

    setIsClosing(true);
    setAnimateInner(false);
    setTimeout(() => {
      setAnimateBody(false);
      setTimeout(() => {
        setAnimateHeader(false);
        setTimeout(() => {
          setAnimatePanel(false);
          setIsClosing(false);
        }, 400);
      }, 500);
    }, 200);
  };

  // When dropdown closes, clear local input (but keep results until user clears)
  useEffect(() => {
    if (!satellitesOpen) setSearchQuery("");
  }, [satellitesOpen]);

  // user clicks show all
  const handleAllCheckbox = (e) => {
    setSearchResults(null);
    setSearchError(null);
    setSearchQuery("");
    if (onSatelliteSelect) onSatelliteSelect("ALL");
  };

  // user selects sat from list
  const handleSatelliteSelection = (satellite) => {
    // If selection came from search results, add it to main list via callback
    const fromSearch = Array.isArray(searchResults);

    setSearchResults(null);
    setSearchQuery("");
    setSearchError(null);

    if (fromSearch && typeof onAddSatellite === "function") {
      try {
        onAddSatellite(satellite);
      } catch (e) {
        // swallow - parent will handle errors
      }
    }

    if (onSatelliteSelect) onSatelliteSelect(satellite);
  };

  const handleGenerateHeatmap = () => {
    if (onGenerateHeatmap) onGenerateHeatmap();
  };

  // Perform search only when search button clicked or Enter pressed
  const performSearch = async (query) => {
    const q = String(query ?? "").trim();
    setSearchError(null);

    if (!q) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const API_BASE_URL =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
      const url = `${API_BASE_URL}/search_results?search=${encodeURIComponent(
        q
      )}`;
      const resp = await fetch(url, { method: "GET", mode: "cors" });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        setSearchResults([]);
        setSearchError(`Search failed: HTTP ${resp.status}`);
        setIsSearching(false);
        return;
      }

      const data = await resp.json().catch(() => null);
      const arr = Array.isArray(data) ? data : data?.satellites ?? [];
      if (!Array.isArray(arr)) {
        setSearchResults([]);
        setSearchError("Search returned unexpected shape.");
      } else {
        setSearchResults(arr);
        if (arr.length === 0)
          setSearchError("No satellites found for that query.");
      }
    } catch (err) {
      setSearchError("Network error or CORS issue while searching.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Enter key
  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      performSearch(searchQuery);
    }
  };

  // clear search
  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
    setSearchError(null);
  };

  if (!isVisible && !animatePanel && !isClosing) return null;

  return (
    <div
      className={`control-panel-container ${
        isVisible ? "visible" : isClosing ? "closing" : ""
      }`}
    >
      <div
        ref={panelRef}
        className={`control-panel ${
          animatePanel ? "animate-panel" : isClosing ? "closing-panel" : ""
        }`}
      >
        <div
          ref={headerRef}
          className={`panel-header ${
            animateHeader ? "animate-header" : isClosing ? "closing-header" : ""
          }`}
        >
          SYSTEM CONTROL
        </div>

        <div
          className={`panel-body ${
            animateBody ? "animate-body" : isClosing ? "closing-body" : ""
          }`}
        >
          <div className="scan-lines" />
          <div className="grid-pattern" />
          <div className="holo-shimmer" />
          <div className="radar" />

          <div className="body-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="all-row">
              <label className="neon-checkbox">
                <input
                  type="checkbox"
                  checked={showAllSatellites}
                  onChange={handleAllCheckbox}
                />
                <span className="checkmark" />
                <span className="label-text">Show All</span>
              </label>
            </div>

            <div className={`sat-box ${satellitesOpen ? "open" : ""}`}>
              <button
                className="sat-header"
                onClick={(e) => {
                  e.stopPropagation();
                  setSatellitesOpen((v) => !v);
                }}
                aria-expanded={satellitesOpen}
                aria-controls="satellite-list"
              >
                <span className="sat-title">
                  Satellites {isLoadingSatellites ? "(Loading...)" : ""}
                </span>
                <span
                  className={`chevron ${satellitesOpen ? "rot" : ""}`}
                  aria-hidden="true"
                />
              </button>

              {satellitesOpen && (
                <div
                  className="sat-search"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="search-icon" aria-hidden="true" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Type name then press Enter or click Search"
                    aria-label="Search satellites"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      className="clear-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearSearch();
                      }}
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="search-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      performSearch(searchQuery);
                    }}
                    aria-label="Perform search"
                    disabled={isSearching}
                    style={{
                      marginLeft: 8,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(0,170,255,0.4)",
                      background: isSearching
                        ? "rgba(0,170,255,0.12)"
                        : "linear-gradient(90deg, rgba(0,170,255,0.12), rgba(0,170,255,0.04))",
                      color: "#e6fbff",
                      cursor: isSearching ? "wait" : "pointer",
                    }}
                  >
                    {isSearching ? "Searching…" : "Search"}
                  </button>
                </div>
              )}

              <div
                id="satellite-list"
                className={`sat-list ${satellitesOpen ? "show" : ""}`}
                role="listbox"
                aria-multiselectable="false"
                onClick={(e) => e.stopPropagation()}
              >
                {isLoadingSatellites ? (
                  <div className="sat-empty">Loading satellites...</div>
                ) : (
                  <>
                    {searchError && (
                      <div
                        className="sat-empty"
                        style={{ color: "salmon", fontSize: 12 }}
                      >
                        {searchError}
                      </div>
                    )}

                    {!displayedList || displayedList.length === 0 ? (
                      <div className="sat-empty">
                        {Array.isArray(searchResults)
                          ? "No satellites found"
                          : "No satellites available"}
                      </div>
                    ) : (
                      displayedList.map((satellite, index) => {
                        const name =
                          satellite?.name ?? `Satellite ${index + 1}`;
                        const isSelected = selectedSatelliteName === name;
                        return (
                          <div
                            key={`${String(name)}-${index}`}
                            className={`sat-row ${
                              isSelected ? "selected" : ""
                            }`}
                            role="option"
                            aria-selected={isSelected}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSatelliteSelection(satellite);
                            }}
                          >
                            <div>
                              <div className="sat-name">{name}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </>
                )}
              </div>
            </div>

            {isSpecificSatelliteSelected && (
              <div className="holo-button-container">
                <HoloButton
                  onClick={handleGenerateHeatmap}
                  label="Simulate Error Prediction"
                />
              </div>
            )}
          </div>

          <div
            className={`panel-inner ${
              animateInner ? "animate-inner" : isClosing ? "closing-inner" : ""
            }`}
          />
        </div>

        <div className="side-glow left" />
        <div className="side-glow right" />
      </div>
    </div>
  );
};

export default ControlPanel;
