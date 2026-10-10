package expo.modules.spawtopening

import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.Choreographer
import android.view.View
import android.view.ViewTreeObserver
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Attend le retrait réel du splash, et pas seulement sa condition Expo. */
class SpawtOpeningModule : Module() {
  private val handler = Handler(Looper.getMainLooper())
  private var prepared = false
  private var retired = false
  private var drawView: View? = null
  private var drawListener: ViewTreeObserver.OnDrawListener? = null
  private val waiting = mutableListOf<Promise>()
  private var fallback: Runnable? = null

  private fun afterPaint(action: () -> Unit) {
    Choreographer.getInstance().postFrameCallback {
      Choreographer.getInstance().postFrameCallback { action() }
    }
  }

  private fun complete() {
    if (retired) return
    retired = true
    fallback?.let { handler.removeCallbacks(it) }
    fallback = null
    waiting.forEach { it.resolve(null) }
    waiting.clear()
  }

  private fun removeDrawListener() {
    drawListener?.let { listener ->
      drawView?.viewTreeObserver?.takeIf { it.isAlive }?.removeOnDrawListener(listener)
    }
    drawListener = null
    drawView = null
  }

  override fun definition() = ModuleDefinition {
    Name("SpawtOpening")

    AsyncFunction("prepareAsync") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("ERR_OPENING_ACTIVITY", "Activity unavailable", null)
      } else {
        if (!prepared) {
          prepared = true
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            activity.splashScreen.setOnExitAnimationListener { provider ->
              provider.remove()
              afterPaint { complete() }
            }
          } else {
            // Avant Android 12, la première vue dessinée confirme le relais.
            val content = activity.findViewById<View>(android.R.id.content)
            drawView = content
            val listener = ViewTreeObserver.OnDrawListener {
              content.post { removeDrawListener(); afterPaint { complete() } }
            }
            drawListener = listener
            content.viewTreeObserver.addOnDrawListener(listener)
          }
        }
        promise.resolve(null)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("waitAsync") { promise: Promise ->
      if (retired) promise.resolve(null)
      else {
        waiting.add(promise)
        if (fallback == null) {
          // Une activité déjà visible peut ne plus avoir de splash à retirer.
          fallback = Runnable {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
              appContext.currentActivity?.splashScreen?.clearOnExitAnimationListener()
            }
            removeDrawListener()
            afterPaint { complete() }
          }
          handler.postDelayed(fallback!!, 2000)
        }
      }
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      handler.post {
        fallback?.let { handler.removeCallbacks(it) }
        fallback = null
        removeDrawListener()
        waiting.clear()
      }
    }
  }
}
