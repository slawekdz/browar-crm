package pl.browarpogorza.crm;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Android 15 draws the app edge-to-edge, so the status bar and the gesture bar would cover the
 * page header and the bottom navigation. Pad the WebView by the system bar insets and paint the
 * padded strips in the app's indigo so they read as part of the chrome.
 */
public class MainActivity extends BridgeActivity {
    private static final int INDIGO = Color.parseColor("#1F2A5A");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        View web = getBridge().getWebView();
        web.setBackgroundColor(INDIGO);
        View root = (View) web.getParent();
        if (root != null) root.setBackgroundColor(INDIGO);
        ViewCompat.setOnApplyWindowInsetsListener(web, (view, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), web);
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);
    }
}
