package main

import "fyne.io/systray"

const repoURL = "https://github.com/claude-settings-xyz/claudia"

func runTray(url string, onExit func()) {
	systray.Run(func() {
		systray.SetTemplateIcon(templateIcon(), colorIcon())
		systray.SetTooltip("Claudia")

		open := systray.AddMenuItem("Open", "Open Claudia in your browser")
		github := systray.AddMenuItem("GitHub", "Open the Claudia repository on GitHub")
		systray.AddSeparator()
		quit := systray.AddMenuItem("Quit", "Quit Claudia")

		go func() {
			for {
				select {
				case <-open.ClickedCh:
					openBrowser(url)
				case <-github.ClickedCh:
					openBrowser(repoURL)
				case <-quit.ClickedCh:
					systray.Quit()
					return
				}
			}
		}()
	}, onExit)
}
