import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'lamp_entry.dart';

/// Runs the *actual online React/Aceternity Lamp* as a native webview on
/// Android/iOS. The CTA is intercepted and opens the original local Flutter
/// workspace, not the nested Flutter Web app.
///
/// The locally rendered LampEntry remains the explicit offline fallback.
class PocketLampEntrance extends StatelessWidget {
  const PocketLampEntrance({super.key, required this.onEnter});

  final VoidCallback onEnter;

  @override
  Widget build(BuildContext context) {
    final supported = !kIsWeb &&
        (defaultTargetPlatform == TargetPlatform.android ||
            defaultTargetPlatform == TargetPlatform.iOS);
    return supported
        ? _OriginalLampWebView(onEnter: onEnter)
        : LampEntry(onEnter: onEnter);
  }
}

class _OriginalLampWebView extends StatefulWidget {
  const _OriginalLampWebView({required this.onEnter});

  final VoidCallback onEnter;

  @override
  State<_OriginalLampWebView> createState() => _OriginalLampWebViewState();
}

class _OriginalLampWebViewState extends State<_OriginalLampWebView> {
  static final Uri _lampUrl = Uri.parse('https://haiz.space/lamp-preview/');

  late final WebViewController _controller;
  Timer? _timeout;
  bool _loaded = false;
  bool _offline = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setBackgroundColor(const Color(0xFF020617))
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (url) {
            if (mounted && !_loaded) setState(() => _loaded = true);
            _timeout?.cancel();
          },
          onWebResourceError: (error) {
            if (mounted && error.isForMainFrame == true) {
              setState(() => _offline = true);
            }
          },
          onNavigationRequest: (request) {
            final target = Uri.tryParse(request.url);
            if (target == null || target.scheme != 'https' ||
                target.host != 'haiz.space') {
              return NavigationDecision.prevent;
            }
            // The Lamp's CTA is the only path that can enter the local app.
            // Do not navigate to the second Flutter Web runtime inside WebView.
            if (target.path == '/lamp-preview/app/' &&
                target.queryParameters['fromLamp'] == '1') {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) widget.onEnter();
              });
              return NavigationDecision.prevent;
            }
            return target.path == '/lamp-preview/'
                ? NavigationDecision.navigate
                : NavigationDecision.prevent;
          },
        ),
      )
      ..loadRequest(_lampUrl);
    // Students can use local data without network access, even if the remote
    // welcome page takes too long to respond.
    _timeout = Timer(const Duration(seconds: 8), () {
      if (mounted && !_loaded) setState(() => _offline = true);
    });
  }

  @override
  void dispose() {
    _timeout?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_offline) return LampEntry(onEnter: widget.onEnter);

    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      body: SafeArea(
        child: Stack(
          children: [
            Positioned.fill(child: WebViewWidget(controller: _controller)),
            if (!_loaded)
              const Positioned.fill(
                child: Center(
                  child: CircularProgressIndicator(
                    color: Color(0xFF66D9E3),
                  ),
                ),
              ),
            Positioned(
              right: 12,
              top: 12,
              child: TextButton(
                key: const Key('lamp-offline-fallback'),
                onPressed: () => setState(() => _offline = true),
                child: const Text(
                  '离线入口',
                  style: TextStyle(color: Color(0xFFB3D8E0), fontSize: 12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
