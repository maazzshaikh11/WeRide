package com.weride

import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "weride"

  /**
   * Orientation policy (docs/RESPONSIVE.md): phones are portrait-only, tablets (smallest width >= 600 dp, which
   * includes an unfolded foldable's inner screen) rotate freely. Applied before the first frame so a phone never
   * flashes in landscape, and again when the configuration changes (a foldable opening or closing).
   */
  private fun applyOrientationPolicy(config: Configuration = resources.configuration) {
    requestedOrientation =
        if (config.smallestScreenWidthDp < TABLET_MIN_SMALLEST_WIDTH_DP)
            ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        else ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    applyOrientationPolicy()
    super.onCreate(savedInstanceState)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    applyOrientationPolicy(newConfig)
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  companion object {
    /** Same threshold as the JS side (theme/responsive.ts TABLET_MIN_SIDE). */
    const val TABLET_MIN_SMALLEST_WIDTH_DP = 600
  }
}
