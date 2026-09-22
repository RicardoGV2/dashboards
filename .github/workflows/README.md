# Workflows

`ci.yml` installs dependencies, runs core tests, typechecks/builds and runs Chromium/WebKit browser tests. It does not deploy. Existing Pages settings are unchanged; a reviewed deployment workflow should upload `apps/web/dist` when publishing the editor is requested.
