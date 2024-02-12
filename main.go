package main

import (
	"compress/gzip"
	"embed"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/ghupdate"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	"github.com/labstack/echo/v5"
)

//go:embed all:dist
var distDir embed.FS
var DistDirFS = echo.MustSubFS(distDir, "dist")

func main() {
	app := pocketbase.NewWithConfig(pocketbase.Config{
		DefaultDataDir: "data",
	})

	// ---------------------------------------------------------------
	// Optional plugin flags:
	// ---------------------------------------------------------------

	var hooksDir string
	app.RootCmd.PersistentFlags().StringVar(
		&hooksDir,
		"hooksDir",
		defaultHooksDir(),
		"the directory with the JS app hooks",
	)

	var hooksWatch bool
	app.RootCmd.PersistentFlags().BoolVar(
		&hooksWatch,
		"hooksWatch",
		true,
		"auto restart the app on pb_hooks file change",
	)

	var hooksPool int
	app.RootCmd.PersistentFlags().IntVar(
		&hooksPool,
		"hooksPool",
		25,
		"the total prewarm goja.Runtime instances for the JS app hooks execution",
	)

	var migrationsDir string
	app.RootCmd.PersistentFlags().StringVar(
		&migrationsDir,
		"migrationsDir",
		defaultMigrationsDir(),
		"the directory with the user defined migrations",
	)

	var automigrate bool
	app.RootCmd.PersistentFlags().BoolVar(
		&automigrate,
		"automigrate",
		true,
		"enable/disable auto migrations",
	)

	var publicDir string
	app.RootCmd.PersistentFlags().StringVar(
		&publicDir,
		"publicDir",
		defaultPublicDir(),
		"the directory to serve static files",
	)

	var indexFallback bool
	app.RootCmd.PersistentFlags().BoolVar(
		&indexFallback,
		"indexFallback",
		true,
		"fallback the request to index.html on missing static path (eg. when pretty urls are used with SPA)",
	)

	var queryTimeout int
	app.RootCmd.PersistentFlags().IntVar(
		&queryTimeout,
		"queryTimeout",
		30,
		"the default SELECT queries timeout in seconds",
	)

	app.RootCmd.ParseFlags(os.Args[1:])

	// ---------------------------------------------------------------
	// Plugins and hooks:
	// ---------------------------------------------------------------

	// load jsvm (hooks and migrations)
	jsvm.MustRegister(app, jsvm.Config{
		MigrationsDir: migrationsDir,
		HooksDir:      hooksDir,
		HooksWatch:    hooksWatch,
		HooksPoolSize: hooksPool,
	})

	// migrate command (with js templates)
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		TemplateLang: migratecmd.TemplateLangJS,
		Automigrate:  automigrate,
		Dir:          migrationsDir,
	})

	// GitHub selfupdate
	ghupdate.MustRegister(app, app.RootCmd, ghupdate.Config{})

	app.OnAfterBootstrap().PreAdd(func(e *core.BootstrapEvent) error {
		app.Dao().ModelQueryTimeout = time.Duration(queryTimeout) * time.Second
		return nil
	})

	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {

		e.Router.Use(adminStylesMiddleware)
		// serves static files from the provided public dir (if exists)
		e.Router.GET("/commrad/*", apis.StaticDirectoryHandler(DistDirFS, false))
		e.Router.GET("/*", apis.StaticDirectoryHandler(os.DirFS(publicDir), indexFallback))

		return nil
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

type CustomWriter struct {
    http.ResponseWriter
    io.Writer
}

func (cw *CustomWriter) Write(p []byte) (n int, err error) {
    return cw.Writer.Write(p)
}

func adminStylesMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {

		// If the request is not for the admin or has an extension proceed with the next middleware
		if !strings.HasPrefix(c.Request().URL.Path, "/_") || strings.Contains(c.Request().URL.Path, ".") {
			return next(c)
		}

		// Create a response recorder to capture the response
		recorder := httptest.NewRecorder()

		// Replace the response writer with the recorder
		originalWriter := c.Response().Writer
		c.Response().Writer = recorder

		// Proceed with the request
		err := next(c)
		if err != nil {
			c.Error(err)
			return err
		}

		// Get the original response
		original := recorder.Result()

		// If the status code is 200 
		if original.Header.Get("Content-Type") == "text/html; charset=utf-8" {
			var body string
			if strings.Contains(original.Header.Get("Content-Encoding"), "gzip") {
				// Decompress the response
				reader, err := gzip.NewReader(original.Body)
				if err != nil {
					return err
				}
				defer reader.Close()
				bodyBytes, err := ioutil.ReadAll(reader)
				if err != nil {
					return err
				}
				body = string(bodyBytes)
			} else {
				body = recorder.Body.String()
			}

			// Modify the response (example: adding a footer)
			modifiedBody := strings.Replace(body, "</head>", `<style>
				.logo { 
					display: none; 
				} 
				.app-sidebar .main-menu { 
					margin-top: 0px; 
				} 
				.page-footer a, .page-footer .delimiter { 
					display: none; 
				}
				.page-header .btns-group > button:first-child {
					display: none;
				}
			</style>
			<link rel="stylesheet" href="/admin.css">
			</head>`, 1)

			// Write the modified content back to the original response writer
			_, err = originalWriter.Write([]byte(modifiedBody))
			if err != nil {
				return err
			}

		} else {

			// Copy the original headers and status code
			for k, v := range original.Header {
				originalWriter.Header().Set(k, v[0])
			}

			originalWriter.WriteHeader(original.StatusCode)

			// Copy the original body
			bodyBytes, err := io.ReadAll(original.Body)
			if err != nil {
				return err
			}
			_, err = originalWriter.Write(bodyBytes)
			if err != nil {
				return err
			}
		}

		return nil
	}
}

// the default pb_public dir location is relative to the executable
func defaultPublicDir() string {
	if strings.HasPrefix(os.Args[0], os.TempDir()) {
		// most likely ran with go run
		return "./public"
	}

	return filepath.Join(os.Args[0], "../public")
}

func defaultDataDir() string {
	if strings.HasPrefix(os.Args[0], os.TempDir()) {
		// most likely ran with go run
		return "./data"
	}

	return filepath.Join(os.Args[0], "../public")
}

func defaultMigrationsDir() string {
	if strings.HasPrefix(os.Args[0], os.TempDir()) {
		// most likely ran with go run
		return "./migrations"
	}

	return filepath.Join(os.Args[0], "../migrations")
}

func defaultHooksDir() string {
	if strings.HasPrefix(os.Args[0], os.TempDir()) {
		// most likely ran with go run
		return "./hooks"
	}

	return filepath.Join(os.Args[0], "../hooks")
}
