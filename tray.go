package main

import "fyne.io/systray"

func runTray(url string, onExit func()) {
	systray.Run(func() {
		systray.SetTemplateIcon(templateIcon(), colorIcon())
		systray.SetTooltip("Claudia")

		open := systray.AddMenuItem("Open", "Open Claudia in your browser")
		systray.AddSeparator()
		quit := systray.AddMenuItem("Quit", "Quit Claudia")

		go func() {
			for {
				select {
				case <-open.ClickedCh:
					openBrowser(url)
				case <-quit.ClickedCh:
					systray.Quit()
					return
				}
			}
		}()
	}, onExit)
}
