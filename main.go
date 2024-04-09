package main

import (
	"compress/gzip"
	"embed"
	"fmt"
	"io"
	"io/fs"
	"io/ioutil"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	"github.com/labstack/echo/v5"
)

//go:embed all:lib/dist
var distDir embed.FS
var DistDirFS = echo.MustSubFS(distDir, "lib/dist")

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
		false,
		"fallback the request to index.html on missing static path (eg. when pretty urls are used with SPA)",
	)

	var devMode bool
	app.RootCmd.PersistentFlags().BoolVar(
		&devMode,
		"devMode",
		false,
		"enable/disable development mode",
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

	app.OnAfterBootstrap().PreAdd(func(e *core.BootstrapEvent) error {
		app.Dao().ModelQueryTimeout = time.Duration(queryTimeout) * time.Second
		return nil
	})

	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {

		e.Router.HTTPErrorHandler = customHTTPErrorHandler

		e.Router.Pre(normalizePath)
		e.Router.Use(rewritePath)
		e.Router.Use(adminStylesMiddleware)
		// If not in dev mode, serve the static files from the embedded dist directory, otherwise serve from the OS dist directory
		if devMode {
			e.Router.GET("/commrad/*", apis.StaticDirectoryHandler(os.DirFS(devDistDir()), false))
		} else {
			e.Router.GET("/commrad/*", apis.StaticDirectoryHandler(DistDirFS, false))
		}

		e.Router.GET("/*", apis.StaticDirectoryHandler(os.DirFS(publicDir), indexFallback))

		// Walk through the directory and add dynamic routes
		filepath.WalkDir("public", func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
	
			// If the file path ends with .html and includes [] brackets, it is a dynamic route
			if filepath.Ext(path) == ".html" && strings.Contains(path, "[") && strings.Contains(path, "]") {
				route := createDynamicRouteFromPath(path)
				// If the route ends with /index, register the route without the /index
				if strings.HasSuffix(route, "/index") {
					routeWithoutIndex := strings.TrimSuffix(route, "/index")
					e.Router.GET(routeWithoutIndex, handleDynamicRouteRequest)
				}
				e.Router.GET(route, handleDynamicRouteRequest)
			}
	
			return nil
		})

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

func createDynamicRouteFromPath(path string) string {
    // Logic to convert file path to route, e.g., "performances/123.html" -> "performances/:id"
    // Implement this based on your directory structure and routing needs

	// Remove the public directory from the path
	path = strings.Replace(path, "public/", "", 1)

	// Replace any string contained within [] with the same string but with a colon in front
	route := regexp.MustCompile(`\[(.*?)\]`).ReplaceAllString(path, ":$1")

	// Remove the .html extension
	route = strings.TrimSuffix(route, ".html")

	return route
}

// handleDynamicRouteRequest is the handler for dynamic routes
func handleDynamicRouteRequest(c echo.Context) error {

	// Create a JSON string of the request path parameters
	params := c.PathParams()
	htmlPath := c.Request().URL.Path

	// Create a checkPath variable to check if a file exists at the path
	checkPath := fmt.Sprintf("public%s.html", htmlPath)

	// Check if the file exists
	if _, err := os.Stat(checkPath); err == nil {
		// If the file exists, return the file
		return c.File(checkPath)
	}

	// If the file has an extension, return the file
	if len(params) == 0 || strings.Contains(htmlPath, ".") {
		// Prepend the public directory to the HTML path
		htmlPath = fmt.Sprintf("public%s", htmlPath)
		return c.File(htmlPath)
	}

	paramsJSON := "{"
	// Iterate over the path parameters and add them to the JSON string
	for _, value := range params {
		// Convert the value to a string
		valueStr := fmt.Sprintf("%v", value)

		// Remove curly braces from the value
		valueStr = strings.Replace(valueStr, "{", "", -1)
		valueStr = strings.Replace(valueStr, "}", "", -1)

		// Spring the value string by the space character, and use the first element as the key, and the second element as the value
		valueStrSplit := strings.Split(valueStr, " ")

		// Replace the value with the key in [] brackets in the HTML path
		htmlPath = strings.Replace(htmlPath, valueStrSplit[1], fmt.Sprintf("[%s]", valueStrSplit[0]), 1)

		// Add the key and value to the JSON string
		paramsJSON += fmt.Sprintf(`"%s": "%s",`, valueStrSplit[0], valueStrSplit[1])
	}

	// Remove the last comma from the JSON string
	paramsJSON = strings.TrimSuffix(paramsJSON, ",")
	paramsJSON += "}"

	// If htmlPath does not start with a slash, add a slash to the beginning
	if !strings.HasPrefix(htmlPath, "/") {
		htmlPath = fmt.Sprintf("/%s", htmlPath)
	}

	// Append the publicDir to the HTML path
	htmlPath = fmt.Sprintf("public%s.html", htmlPath)

	// Check if the file exists
	if _, err := os.Stat(htmlPath); os.IsNotExist(err) {
		log.Fatalf("File does not exist: %s", htmlPath)
		return err
	}

	// Check if the file is readable
	file, err := os.Open(htmlPath)
	if err != nil {
		log.Fatalf("Failed to open file: %s", err)
		return err
	}
	file.Close()

	// Read the file
	content, err := ioutil.ReadFile(htmlPath)
	if err != nil {
		log.Fatalf("Failed to read file: %s", err)
		return err
	}

	// Modify content to include the JSON string in a script tag at the end of the body
	if strings.Contains(string(content), "</head>") {
		content = []byte(strings.Replace(string(content), "</head>", fmt.Sprintf(`<script>window.$pathParams = %s;</script></head>`, paramsJSON), 1))
	} else {
		if strings.Contains(string(content), "<body>") {
			content = []byte(strings.Replace(string(content), "<body>", fmt.Sprintf(`<body><script>window.$pathParams = %s;</script>`, paramsJSON), 1))
		}
	}
	
	// Return the content of the file
	return c.HTMLBlob(http.StatusOK, content)

}

func customHTTPErrorHandler(c echo.Context, err error) {
    code := http.StatusInternalServerError
    if he, ok := err.(*echo.HTTPError); ok {
        code = he.Code
    }
	// Print the error message
	log.Printf("Error: %s", err.Error())
    // Create an error page variable using the code and the public directory
    errorPage := fmt.Sprintf("public/%d.html", code)
    // Check if the error page exists
    if _, err := os.Stat(errorPage); err == nil {
        // If the error page exists, return the error page
        c.File(errorPage)
    } else {
        // If the error page does not exist, return the default error message
        c.String(code, "Internal Server Error")
    }
}

// normalizePath removes the .html extension and trailing slash from the URL path
func normalizePath(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		path := c.Request().URL.Path

		// Remove the .html extension if it exists
		path = strings.TrimSuffix(path, ".html")

		// Remove the trailing slash from the URL, if it exists and the path is not just the root "/"
		if path != "/" && strings.HasSuffix(path, "/") {
			path = path[:len(path)-1]
		}

		// Update the request path
		c.Request().URL.Path = path

		return next(c)
	}
}

// rewritePath adds /index to the request path if the last path parameter matches the ending of the request path
func rewritePath(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		// If the request is for the admin or has an extension, proceed with the next middleware
		if strings.HasPrefix(c.Request().URL.Path, "/_") || strings.HasPrefix(c.Request().URL.Path, "/api") || strings.Contains(c.Request().URL.Path, ".") {
			return next(c)
		}

		params := c.PathParams()

		// If the value of the last path parameter matches the ending of the request path, then add /index to the request path
		if len(params) > 0 {
			lastParam := params[len(params)-1]
			if strings.HasSuffix(c.Request().URL.Path, lastParam.Value) {
				c.Request().URL.Path = fmt.Sprintf("%s/index", c.Request().URL.Path)
			}
		}

		return next(c)
	}
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

func devDistDir() string {
	if strings.HasPrefix(os.Args[0], os.TempDir()) {
		// most likely ran with go run
		return "./lib/dist"
	}

	return filepath.Join(os.Args[0], "../dist")
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
