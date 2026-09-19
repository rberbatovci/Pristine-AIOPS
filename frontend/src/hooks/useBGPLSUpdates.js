import { useState, useCallback } from "react";
import kcFetch from "../components/misc/kcFetch";

const PAGE_SIZE = 22;

export function useBgpLinkStateData() {
  const [eventsData, setEventsData] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadData = useCallback(
    async (
      keycloak,
      page = 1,
      startTime = null,
      endTime = null,
      filters = {}
    ) => {
      // ------------------------------------------------------
      // Authentication
      // ------------------------------------------------------

      if (!keycloak?.authenticated) {
        setError("User is not authenticated");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // ----------------------------------------------------
        // Base query parameters
        // ----------------------------------------------------

        const query = new URLSearchParams({
          page: page.toString(),
          page_size: PAGE_SIZE.toString(),
        });

        // ----------------------------------------------------
        // Time filters
        // ----------------------------------------------------

        if (startTime) {
          query.append(
            "start_time",
            new Date(startTime).toISOString()
          );
        }

        if (endTime) {
          query.append(
            "end_time",
            new Date(endTime).toISOString()
          );
        }

        // ----------------------------------------------------
        // Array filters
        // ----------------------------------------------------

        const arrayFilters = [
          // Event
          {
            key: "event_type",
            values: filters.event_type,
          },
          {
            key: "nlri_type",
            values: filters.nlri_type,
          },

          // Protocol
          {
            key: "protocol",
            values: filters.protocol,
          },
          {
            key: "protocol_level",
            values: filters.protocol_level,
          },

          // Source
          {
            key: "source_ip",
            values: filters.source_ip,
          },
          {
            key: "neighbor_ip",
            values: filters.neighbor_ip,
          },

          // Local node
          {
            key: "local_router_id",
            values: filters.local_router_id,
          },

          // Remote node
          {
            key: "remote_router_id",
            values: filters.remote_router_id,
          },

          // Node information
          {
            key: "node_name",
            values: filters.node_name,
          },
          {
            key: "isis_area",
            values: filters.isis_area,
          },

          // Prefix
          {
            key: "prefix",
            values: filters.prefix,
          },

          // Next hop
          {
            key: "next_hop",
            values: filters.next_hop,
          },

          // Topology
          {
            key: "topology_key",
            values: filters.topology_key,
          },
        ];

        arrayFilters.forEach(({ key, values }) => {
          if (!Array.isArray(values)) {
            return;
          }

          values.forEach((value) => {
            if (
              value !== undefined &&
              value !== null &&
              value !== ""
            ) {
              query.append(key, value);
            }
          });
        });

        // ----------------------------------------------------
        // Numeric filters
        // ----------------------------------------------------

        const numericFilters = [
          {
            key: "source_asn",
            value: filters.source_asn,
          },
          {
            key: "local_asn",
            value: filters.local_asn,
          },
          {
            key: "remote_asn",
            value: filters.remote_asn,
          },
          {
            key: "link_metric",
            value: filters.link_metric,
          },
          {
            key: "local_pref",
            value: filters.local_pref,
          },
        ];

        numericFilters.forEach(({ key, value }) => {
          if (
            value === undefined ||
            value === null ||
            value === ""
          ) {
            return;
          }

          if (Array.isArray(value)) {
            value.forEach((item) => {
              if (
                item !== undefined &&
                item !== null &&
                item !== ""
              ) {
                query.append(key, item);
              }
            });
          } else {
            query.append(key, value);
          }
        });

        // ----------------------------------------------------
        // Boolean filter
        // ----------------------------------------------------

        if (
          filters.is_withdraw !== undefined &&
          filters.is_withdraw !== null &&
          filters.is_withdraw !== ""
        ) {
          query.append(
            "is_withdraw",
            filters.is_withdraw.toString()
          );
        }

        // ----------------------------------------------------
        // Generic tag filters
        // ----------------------------------------------------

        if (
          filters.tags &&
          typeof filters.tags === "object"
        ) {
          Object.entries(filters.tags).forEach(
            ([key, values]) => {
              if (!Array.isArray(values)) {
                return;
              }

              const cleanKey = key.trim();

              if (!cleanKey) {
                return;
              }

              values.forEach((value) => {
                if (
                  value !== undefined &&
                  value !== null &&
                  value !== ""
                ) {
                  query.append(cleanKey, value);
                }
              });
            }
          );
        }

        // ----------------------------------------------------
        // API request
        // ----------------------------------------------------

        const endpoint =
          `/topology/updates/events?${query.toString()}`;

        const response = await kcFetch(
          keycloak,
          endpoint
        );

        console.log(
          "BGP-LS API response:",
          response
        );

        // ----------------------------------------------------
        // Process API response
        // ----------------------------------------------------

        let rawResults = [];
        let totalCount = 0;
        let apiTotalPages = 0;

        // ----------------------------------------------------
        // New backend format
        //
        // {
        //   data: [],
        //   pagination: {}
        // }
        // ----------------------------------------------------

        if (Array.isArray(response?.data)) {
          rawResults = response.data;

          totalCount = Number(
            response.pagination?.total ?? rawResults.length
          );

          apiTotalPages = Number(
            response.pagination?.total_pages ??
              Math.ceil(totalCount / PAGE_SIZE)
          );
        }

        // ----------------------------------------------------
        // Elasticsearch/OpenSearch style response
        //
        // {
        //   results: [],
        //   total: ...
        // }
        // ----------------------------------------------------

        else if (Array.isArray(response?.results)) {
          rawResults = response.results.map(
            (item) => item._source || item
          );

          totalCount = Number(
            response.total ?? rawResults.length
          );

          apiTotalPages = Math.ceil(
            totalCount / PAGE_SIZE
          );
        }

        // ----------------------------------------------------
        // Direct array response
        // ----------------------------------------------------

        else if (Array.isArray(response)) {
          rawResults = response.map(
            (item) => item._source || item
          );

          totalCount = rawResults.length;

          apiTotalPages = Math.ceil(
            totalCount / PAGE_SIZE
          );
        }

        // ----------------------------------------------------
        // Unexpected response
        // ----------------------------------------------------

        else {
          console.warn(
            "Unexpected BGP Link State response:",
            response
          );
        }

        // ----------------------------------------------------
        // Normalize frontend data
        // ----------------------------------------------------

        const results = rawResults.map((item) => {
          // -----------------------------------------------
          // Normalize NLRI type
          // -----------------------------------------------

          let nlriType = item.nlri_type || "";

          switch (nlriType) {
            case "LS_NLRI_NODE":
              nlriType = "NODE";
              break;

            case "LS_NLRI_LINK":
              nlriType = "LINK";
              break;

            case "LS_NLRI_PREFIX_V4":
            case "LS_NLRI_PREFIX_V6":
            case "LS_NLRI_PREFIX_IPV4":
            case "LS_NLRI_PREFIX_IPV6":
              nlriType = "PREFIX";
              break;

            default:
              break;
          }

          // -----------------------------------------------
          // Normalize event type
          // -----------------------------------------------

          const eventType =
            item.event_type || "update";

          // -----------------------------------------------
          // Normalize withdrawal
          // -----------------------------------------------

          const isWithdraw =
            item.is_withdraw === true;

          // -----------------------------------------------
          // Return normalized object
          // -----------------------------------------------

          return {
            // ---------------------------------------------
            // Identity
            // ---------------------------------------------

            id: item.id || item.event_id || "",

            event_id:
              item.event_id ||
              item.id ||
              "",

            topology_key:
              item.topology_key || "",

            // ---------------------------------------------
            // Event
            // ---------------------------------------------

            timestamp:
              item.timestamp || null,

            ingested_at:
              item.ingested_at || null,

            event_type: eventType,

            is_withdraw: isWithdraw,

            // ---------------------------------------------
            // BGP-LS
            // ---------------------------------------------

            nlri_type: nlriType,

            protocol:
              item.protocol || "",

            protocol_level:
              item.protocol_level || "",

            // ---------------------------------------------
            // Source
            // ---------------------------------------------

            source_ip:
              item.source_ip || "",

            source_asn:
              item.source_asn ?? null,

            neighbor_ip:
              item.neighbor_ip || "",

            // ---------------------------------------------
            // Local node
            // ---------------------------------------------

            local_router_id:
              item.local_router_id || "",

            local_asn:
              item.local_asn ?? null,

            local_pseudonode:
              item.local_pseudonode === true,

            // ---------------------------------------------
            // Remote node
            // ---------------------------------------------

            remote_router_id:
              item.remote_router_id || "",

            remote_asn:
              item.remote_asn ?? null,

            remote_pseudonode:
              item.remote_pseudonode === true,

            // ---------------------------------------------
            // Node
            // ---------------------------------------------

            node_name:
              item.node_name || "",

            isis_area:
              item.isis_area || "",

            // ---------------------------------------------
            // Link
            // ---------------------------------------------

            link_metric:
              item.link_metric ?? null,

            // ---------------------------------------------
            // Prefix
            // ---------------------------------------------

            prefix:
              item.prefix || "",

            // ---------------------------------------------
            // BGP attributes
            // ---------------------------------------------

            next_hop:
              item.next_hop || "",

            local_pref:
              item.local_pref ?? null,
          };
        });

        // ----------------------------------------------------
        // Update state
        // ----------------------------------------------------

        setEventsData(results);

        setTotalEvents(totalCount);

        setTotalPages(
          apiTotalPages ||
            Math.ceil(totalCount / PAGE_SIZE)
        );
      } catch (err) {
        console.error(
          "Error fetching BGP Link State data:",
          err
        );

        setError(
          err.message ||
            "Failed to fetch BGP Link State data"
        );

        setEventsData([]);
        setTotalEvents(0);
        setTotalPages(0);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    eventsData,
    totalPages,
    totalEvents,
    loading,
    error,
    loadData,
  };
}