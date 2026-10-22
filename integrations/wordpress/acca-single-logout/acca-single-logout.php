<?php
/**
 * Plugin Name: ACCA Single Logout
 * Description: Menutup sesi WordPress pada browser yang logout dari ACCA.
 * Version: 1.0.0
 */

namespace Acca\SingleLogout;

if (!defined('ABSPATH')) { exit; }

function origin_of($url) {
    $parts = wp_parse_url($url);
    if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) { return ''; }
    return strtolower($parts['scheme'] . '://' . $parts['host']) . (isset($parts['port']) ? ':' . $parts['port'] : '');
}

function acca_origin() {
    return origin_of(defined('ACCA_SINGLE_LOGOUT_ORIGIN') ? ACCA_SINGLE_LOGOUT_ORIGIN : 'https://acca.icgowa.sch.id');
}

function handle_request() {
    if (!isset($_GET['acca_single_logout']) || $_GET['acca_single_logout'] !== '1') { return; }
    nocache_headers();
    header('Cache-Control: private, no-store, max-age=0');
    header('Vary: Origin', false);
    // Never accept an arbitrary user ID or redirect. Only the caller's cookie is cleared.
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? wp_unslash($_SERVER['HTTP_ORIGIN']) : '';
    $allowed = array_filter(array(acca_origin(), origin_of(home_url('/')), origin_of(site_url('/'))));
    if (!$origin || !in_array($origin, $allowed, true)) {
        wp_send_json(array('ok' => false, 'error' => 'Origin tidak diizinkan.'), 403);
    }
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { status_header(204); exit; }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        header('Allow: POST, OPTIONS');
        wp_send_json(array('ok' => false, 'error' => 'Gunakan POST.'), 405);
    }
    // WordPress destroys the current session token and clears its authentication cookies.
    wp_logout();
    wp_send_json(array('ok' => true));
}
add_action('init', __NAMESPACE__ . '\\handle_request', 20);

function render_listener() {
    if (!is_user_logged_in()) { return; }
    $endpoint = add_query_arg('acca_single_logout', '1', home_url('/'));
    $login = acca_origin() . '/login?logged_out=1';
    ?>
    <script>
    (function () {
        if (window.__accaLogoutListener) return;
        window.__accaLogoutListener = true;
        var read = function () { return document.cookie.split('; ').find(function (part) { return part.indexOf('acca_logout_at=') === 0; }) || ''; };
        var previous = read(), closing = false;
        function check() {
            var current = read();
            if (!current || current === previous || closing) return;
            closing = true;
            var controller = new AbortController();
            var timer = setTimeout(function () { controller.abort(); }, 10000);
            fetch(<?php echo wp_json_encode($endpoint, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>, {method: 'POST', credentials: 'include', cache: 'no-store', signal: controller.signal})
                .then(function (res) { if (!res.ok) throw new Error('Logout failed'); window.location.replace(<?php echo wp_json_encode($login, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>); })
                .catch(function () { closing = false; })
                .finally(function () { clearTimeout(timer); });
        }
        setInterval(check, 2000);
        window.addEventListener('focus', check);
        document.addEventListener('visibilitychange', check);
    })();
    </script>
    <?php
}
add_action('wp_head', __NAMESPACE__ . '\\render_listener');
add_action('admin_head', __NAMESPACE__ . '\\render_listener');
