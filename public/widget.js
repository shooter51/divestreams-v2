/**
 * DiveStreams Booking Widget Loader
 *
 * Usage:
 * <div id="divestreams-widget" data-tenant="your-subdomain"></div>
 * <script src="https://widget.divestreams.com/widget.js"></script>
 *
 * Or with custom configuration:
 * <script>
 *   DiveStreams.init({
 *     tenant: 'your-subdomain',
 *     container: '#booking-widget',
 *     height: '700px'
 *   });
 * </script>
 */
(function () {
  'use strict';

  // Widget configuration
  var config = {
    baseUrl: window.DIVESTREAMS_BASE_URL || 'https://divestreams.com',
    defaultHeight: '600px',
    defaultWidth: '100%',
  };

  // Main widget object
  var DiveStreams = {
    version: '1.0.0',

    /**
     * Initialize the widget
     * @param {Object} options - Configuration options
     * @param {string} options.tenant - Tenant subdomain (required)
     * @param {string} [options.container] - CSS selector for container element
     * @param {string} [options.height] - iframe height (default: 600px)
     * @param {string} [options.width] - iframe width (default: 100%)
     * @param {Function} [options.onLoad] - Callback when widget loads
     * @param {Function} [options.onBooking] - Callback when booking completes
     */
    init: function (options) {
      if (!options || !options.tenant) {
        console.error('[DiveStreams] tenant is required');
        return;
      }

      var containerSelector = options.container || '#divestreams-widget';
      var container = document.querySelector(containerSelector);

      if (!container) {
        console.error('[DiveStreams] Container not found:', containerSelector);
        return;
      }

      this._createIframe(container, options);
    },

    /**
     * Create and mount the iframe
     * @private
     */
    _createIframe: function (container, options) {
      var iframe = document.createElement('iframe');
      var tenant = options.tenant;
      var embedUrl = config.baseUrl + '/embed/' + tenant;

      iframe.src = embedUrl;
      iframe.style.width = options.width || config.defaultWidth;
      iframe.style.height = options.height || config.defaultHeight;
      iframe.style.border = 'none';
      iframe.style.display = 'block';
      iframe.setAttribute('title', 'Book with ' + tenant);
      iframe.setAttribute('allowtransparency', 'true');
      iframe.setAttribute('allow', 'payment');

      // Handle load event
      iframe.onload = function () {
        if (typeof options.onLoad === 'function') {
          options.onLoad();
        }
      };

      // Clear container and append iframe
      container.innerHTML = '';
      container.appendChild(iframe);

      // Listen for messages from iframe
      window.addEventListener('message', function (event) {
        // Verify origin
        if (event.origin !== config.baseUrl) {
          return;
        }

        var data = event.data;

        // Handle resize messages
        if (data && data.type === 'divestreams:resize') {
          iframe.style.height = data.height + 'px';
        }

        // Handle booking complete messages
        if (data && data.type === 'divestreams:booking_complete') {
          if (typeof options.onBooking === 'function') {
            options.onBooking(data.booking);
          }
        }
      });

      // Store reference for later
      this._iframe = iframe;
      this._container = container;
    },

    /**
     * Destroy the widget
     */
    destroy: function () {
      if (this._container) {
        this._container.innerHTML = '';
      }
      this._iframe = null;
      this._container = null;
    },

    /**
     * Navigate to a specific tour
     * @param {string} tourId - Tour ID to display
     */
    showTour: function (tourId) {
      if (this._iframe) {
        this._iframe.contentWindow.postMessage(
          { type: 'divestreams:navigate', path: '/tour/' + tourId },
          config.baseUrl
        );
      }
    },

    /**
     * Navigate back to tour list
     */
    showTours: function () {
      if (this._iframe) {
        this._iframe.contentWindow.postMessage(
          { type: 'divestreams:navigate', path: '/' },
          config.baseUrl
        );
      }
    },
  };

  // Auto-initialize if container with data-tenant exists
  function autoInit() {
    var container = document.getElementById('divestreams-widget');
    if (container && container.dataset.tenant) {
      DiveStreams.init({
        tenant: container.dataset.tenant,
        container: '#divestreams-widget',
        height: container.dataset.height || config.defaultHeight,
      });
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  // Expose to global scope
  window.DiveStreams = DiveStreams;
})();
