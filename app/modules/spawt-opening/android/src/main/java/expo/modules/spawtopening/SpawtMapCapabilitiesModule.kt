package expo.modules.spawtopening

import android.app.ActivityManager
import android.content.Context
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SpawtMapCapabilitiesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SpawtMapCapabilities")

    AsyncFunction("canRenderAsync") {
      val activity = appContext.currentActivity
      val manager = activity?.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
      val glVersion = manager?.deviceConfigurationInfo?.reqGlEsVersion ?: 0
      // The packaged MapLibre OpenGL backend needs ES 3.0 and a hardware-accelerated TextureView.
      glVersion >= 0x30000 && activity?.window?.decorView?.isHardwareAccelerated == true
    }.runOnQueue(Queues.MAIN)
  }
}
