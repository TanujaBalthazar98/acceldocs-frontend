var DEFAULT_API_BASE = "https://www.docspeare.com";
var BRAND_NAME = "Docspeare Publisher";

function onHomepage(e) {
  try {
    return buildHomeCard_(null);
  } catch (err) {
    return buildErrorCard_("Add-on failed to load: " + err.message);
  }
}

function buildHomeCard_(message) {
  var authInfo = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
  if (authInfo.getAuthorizationStatus() === ScriptApp.AuthorizationStatus.REQUIRED) {
    return buildAuthCard_();
  }

  var props = PropertiesService.getUserProperties();
  var apiBase = props.getProperty("API_BASE_URL") || DEFAULT_API_BASE;
  var webBase = getWebBase_(apiBase);
  var token = props.getProperty("SAAS_TOKEN") || "";
  var docId = getActiveDocIdSafe_();
  var projectId = getDocScopedProperty_(props, docId, "PROJECT_ID") || props.getProperty("PROJECT_ID") || "";
  var projectVersionId = getDocScopedProperty_(props, docId, "PROJECT_VERSION_ID") || props.getProperty("PROJECT_VERSION_ID") || "";
  var topicId = getDocScopedProperty_(props, docId, "TOPIC_ID") || props.getProperty("TOPIC_ID") || "";
  var lastResultUrl = props.getProperty("LAST_RESULT_URL") || "";
  var lastResultLabel = props.getProperty("LAST_RESULT_LABEL") || "Open Result";
  var lastActionLabel = props.getProperty("LAST_ACTION_LABEL") || "";
  var lastActionAt = props.getProperty("LAST_ACTION_AT") || "";
  var docSlug = getDocScopedProperty_(props, docId, "DOC_SLUG") || props.getProperty("DOC_SLUG") || "";
  var lastErrorDetails = props.getProperty("LAST_ERROR_DETAILS") || "";

  var bootstrap = null;
  var bootstrapError = null;
  if (token) {
    var bootstrapResult = loadBootstrap_(apiBase, token, false, docId);
    bootstrap = bootstrapResult.data;
    bootstrapError = bootstrapResult.error;
  }

  var projects = (bootstrap && bootstrap.projects) ? bootstrap.projects : [];
  var projectOptions = buildProjectOptions_(projects);
  var docSelection = bootstrap && bootstrap.docSelection ? bootstrap.docSelection : null;
  if (!projectId && docSelection && docSelection.projectId) {
    projectId = docSelection.projectId;
    setDocScopedProperty_(props, docId, "PROJECT_ID", projectId);
  }
  var autoProjectId = projectId;
  if (!autoProjectId && projectOptions.length === 1) {
    autoProjectId = projectOptions[0].value;
    props.setProperty("PROJECT_ID", autoProjectId);
    setDocScopedProperty_(props, docId, "PROJECT_ID", autoProjectId);
  }

  var projectVersions = (bootstrap && bootstrap.projectVersions) ? bootstrap.projectVersions : [];
  var versionOptions = buildVersionOptions_(projectVersions, autoProjectId);
  if (!projectVersionId && docSelection && docSelection.projectVersionId) {
    projectVersionId = docSelection.projectVersionId;
    setDocScopedProperty_(props, docId, "PROJECT_VERSION_ID", projectVersionId);
  }
  var autoVersionId = projectVersionId || pickDefaultVersionId_(versionOptions);
  if (!projectVersionId && autoVersionId) {
    props.setProperty("PROJECT_VERSION_ID", autoVersionId);
    setDocScopedProperty_(props, docId, "PROJECT_VERSION_ID", autoVersionId);
  }

  var topics = (bootstrap && bootstrap.topics) ? bootstrap.topics : [];
  var topicOptions = buildTopicOptions_(topics, autoProjectId);
  if (!topicId && docSelection && docSelection.topicId) {
    topicId = docSelection.topicId;
    setDocScopedProperty_(props, docId, "TOPIC_ID", topicId);
  }
  if (!docSlug && docSelection && docSelection.slug) {
    docSlug = docSelection.slug;
    setDocScopedProperty_(props, docId, "DOC_SLUG", docSlug);
  }

  var statusSection = CardService.newCardSection()
    .setHeader("Workspace");

  var statusText = "Not connected";
  var statusDetail = "Open Settings to connect your Docspeare token.";
  if (token && !bootstrapError && projectOptions.length > 0) {
    statusText = "Connected";
    statusDetail = "Ready to publish from Google Docs.";
  } else if (token && bootstrapError) {
    statusText = "Needs attention";
    statusDetail = bootstrapError;
  }

  statusSection.addWidget(
    CardService.newDecoratedText()
      .setTopLabel("Connection")
      .setText(statusText)
      .setBottomLabel(statusDetail)
      .setIcon(CardService.Icon.DESCRIPTION)
  );

  statusSection.addWidget(
    CardService.newButtonSet()
      .addButton(
        CardService.newTextButton()
          .setText("Settings")
          .setOnClickAction(CardService.newAction().setFunctionName("openSettings"))
          .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      )
  );

  var targetSection = CardService.newCardSection()
    .setHeader("Publish target");

  if (token && !bootstrapError && projectOptions.length > 0) {
    appendLabeledSelect_(targetSection, "Project", "PROJECT_ID", projectOptions, autoProjectId, false);
    appendLabeledSelect_(targetSection, "Version", "PROJECT_VERSION_ID", versionOptions, autoVersionId, true, "Default version");
    appendLabeledSelect_(targetSection, "Topic", "TOPIC_ID", topicOptions, topicId, true, "No topic");
  } else {
    targetSection.addWidget(CardService.newTextParagraph().setText("Open Settings to connect and load projects."));
  }

  targetSection.addWidget(
    CardService.newButtonSet()
      .addButton(
        CardService.newTextButton()
          .setText("Save Settings")
          .setOnClickAction(CardService.newAction().setFunctionName("saveSettings"))
          .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      )
  );

  var actionSection = CardService.newCardSection()
    .setHeader("Actions")
    .addWidget(CardService.newTextParagraph().setText("Publish or preview the current document."))
    .addWidget(
      CardService.newDecoratedText()
        .setTopLabel("Visibility")
        .setText("Set by project in Docspeare")
    )
    .addWidget(
      CardService.newButtonSet()
        .addButton(
          CardService.newTextButton()
            .setText("Publish")
            .setOnClickAction(CardService.newAction().setFunctionName("publishDoc"))
            .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        )
        .addButton(
          CardService.newTextButton()
            .setText("Preview")
            .setOnClickAction(CardService.newAction().setFunctionName("previewDoc"))
        )
        .addButton(
          CardService.newTextButton()
            .setText("Unpublish")
            .setOnClickAction(CardService.newAction().setFunctionName("unpublishDoc"))
        )
    );

  if (docSlug) {
    actionSection.addWidget(
      CardService.newDecoratedText()
        .setTopLabel("Slug")
        .setText(docSlug)
        .setWrapText(true)
        .setIcon(CardService.Icon.BOOKMARK)
    );
  }

  if (lastActionLabel) {
    actionSection.addWidget(
      CardService.newDecoratedText()
        .setTopLabel("Last action")
        .setText(lastActionLabel + (lastActionAt ? " • " + lastActionAt : ""))
        .setWrapText(true)
        .setIcon(CardService.Icon.CLOCK)
    );
  }

  if (message && message.type === "error") {
    actionSection.addWidget(buildStatusWidgetFromMessage_(message));
    if (lastErrorDetails) {
      actionSection.addWidget(
        CardService.newButtonSet().addButton(
          CardService.newTextButton()
            .setText("View error details")
            .setOnClickAction(CardService.newAction().setFunctionName("showErrorDetails"))
        )
      );
    }
  }

  var advancedSection = CardService.newCardSection()
    .setHeader("Advanced")
    .setCollapsible(true)
    .setNumUncollapsibleWidgets(0)
    .addWidget(buildTextInput_("DOC_SLUG", "Custom slug (optional)", docSlug, "leave blank to auto-generate"))
    .addWidget(
      CardService.newButtonSet()
        .addButton(buildOpenLinkButton_("Open Dashboard", webBase + "/dashboard"))
    );

  if (projectId) {
    advancedSection.addWidget(
      CardService.newButtonSet()
        .addButton(buildOpenLinkButton_("Open Integrations", webBase + "/dashboard?integrations=1&project=" + projectId))
        .addButton(buildOpenLinkButton_("Import Markdown (Dashboard)", webBase + "/dashboard"))
    );
  }

  advancedSection.addWidget(
    CardService.newTextParagraph().setText(
      "<b>Docs views:</b> " +
        '<a href="' + webBase + '/internal">Internal</a> · ' +
        '<a href="' + webBase + '/docs?view=external">External</a> · ' +
        '<a href="' + webBase + '/docs">Public</a>'
    )
  );

  if (lastResultUrl) {
    advancedSection.addWidget(
      CardService.newButtonSet()
        .addButton(buildOpenLinkButton_(lastResultLabel, lastResultUrl))
    );
  }

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(BRAND_NAME))
    .addSection(statusSection)
    .addSection(targetSection)
    .addSection(actionSection)
    .addSection(advancedSection)
    .build();
}

function showErrorDetails() {
  var props = PropertiesService.getUserProperties();
  var details = props.getProperty("LAST_ERROR_DETAILS") || "No additional details available.";
  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(BRAND_NAME))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText("<b>Error details</b><br/>" + escapeHtml_(details)))
        .addWidget(
          CardService.newButtonSet().addButton(
            CardService.newTextButton()
              .setText("Back")
              .setOnClickAction(CardService.newAction().setFunctionName("goHome"))
          )
        )
    )
    .build();

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

function buildTextInput_(fieldName, title, value, hint) {
  return CardService.newTextInput()
    .setFieldName(fieldName)
    .setTitle(title)
    .setValue(value || "")
    .setHint(hint || "");
}

function buildSelectInput_(fieldName, title, options, selectedValue, allowEmpty, emptyLabel) {
  var input = CardService.newSelectionInput()
    .setFieldName(fieldName)
    .setTitle(title || " ")
    .setType(CardService.SelectionInputType.DROPDOWN);

  if (allowEmpty) {
    input.addItem(emptyLabel || "None", "", !selectedValue);
  }

  for (var i = 0; i < options.length; i++) {
    var option = options[i];
    var isSelected = selectedValue && option.value === selectedValue;
    input.addItem(option.label, option.value, !!isSelected);
  }

  return input;
}

function appendLabeledSelect_(section, label, fieldName, options, selectedValue, allowEmpty, emptyLabel) {
  section.addWidget(CardService.newTextParagraph().setText(label));
  section.addWidget(buildSelectInput_(fieldName, "", options, selectedValue, allowEmpty, emptyLabel));
}

function buildOpenLinkButton_(label, url) {
  return CardService.newTextButton()
    .setText(label)
    .setOpenLink(CardService.newOpenLink().setUrl(url));
}

function getWebBase_(apiBase) {
  var base = (apiBase || DEFAULT_API_BASE).replace(/\/$/, "");
  if (base.match(/\/api$/)) {
    base = base.replace(/\/api$/, "");
  }
  return base;
}

function openSettings() {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(buildSettingsCard_(null)))
    .build();
}

function goHome() {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(buildHomeCard_(null)))
    .build();
}

function buildSettingsCard_(message) {
  var props = PropertiesService.getUserProperties();
  var apiBase = props.getProperty("API_BASE_URL") || DEFAULT_API_BASE;
  var webBase = getWebBase_(apiBase);
  var token = props.getProperty("SAAS_TOKEN") || "";
  var projectId = props.getProperty("PROJECT_ID") || "";
  var lastResultUrl = props.getProperty("LAST_RESULT_URL") || "";
  var lastResultLabel = props.getProperty("LAST_RESULT_LABEL") || "Open Result";

  var bootstrapError = null;
  if (token) {
    var bootstrapResult = loadBootstrap_(apiBase, token);
    bootstrapError = bootstrapResult.error;
  }

  var settingsSection = CardService.newCardSection()
    .setHeader("Settings")
    .addWidget(
      CardService.newDecoratedText()
        .setTopLabel("Docspeare token")
        .setText(token ? "Token saved" : "No token yet")
        .setIcon(CardService.Icon.KEY)
    )
    .addWidget(buildTextInput_("SAAS_TOKEN", "Docspeare Token", "", token ? "Saved. Paste a new token to replace." : "Paste the add-on token"))
    .addWidget(
      CardService.newButtonSet()
        .addButton(
          CardService.newTextButton()
            .setText("Refresh")
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName("refreshBootstrap")
                .setParameters({ target: "settings" })
            )
        )
        .addButton(
          CardService.newTextButton()
            .setText("Save")
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName("saveSettings")
                .setParameters({ target: "settings" })
            )
            .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        )
    );

  if (!token) {
    settingsSection.addWidget(buildStatusWidget_("info", "Paste your Docspeare token to load projects and topics."));
  } else if (bootstrapError) {
    settingsSection.addWidget(buildStatusWidget_("error", "Could not load projects: " + bootstrapError));
  }

  if (message) {
    settingsSection.addWidget(buildStatusWidgetFromMessage_(message));
  }

  var linksSection = CardService.newCardSection()
    .setHeader("Docs links")
    .addWidget(
      CardService.newButtonSet()
        .addButton(buildOpenLinkButton_("Open Dashboard", webBase + "/dashboard"))
    );

  if (projectId) {
    linksSection.addWidget(
      CardService.newButtonSet()
        .addButton(buildOpenLinkButton_("Open Integrations", webBase + "/dashboard?integrations=1&project=" + projectId))
        .addButton(buildOpenLinkButton_("Import Markdown (Dashboard)", webBase + "/dashboard"))
    );
  }

  linksSection.addWidget(
    CardService.newTextParagraph().setText(
      "<b>Docs views:</b> " +
        '<a href="' + webBase + '/internal">Internal</a> · ' +
        '<a href="' + webBase + '/docs?view=external">External</a> · ' +
        '<a href="' + webBase + '/docs">Public</a>'
    )
  );

  if (lastResultUrl) {
    linksSection.addWidget(
      CardService.newButtonSet()
        .addButton(buildOpenLinkButton_(lastResultLabel, lastResultUrl))
    );
  }

  var navSection = CardService.newCardSection()
    .addWidget(
      CardService.newButtonSet()
        .addButton(
          CardService.newTextButton()
            .setText("Back")
            .setOnClickAction(CardService.newAction().setFunctionName("goHome"))
        )
    );

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(BRAND_NAME))
    .addSection(settingsSection)
    .addSection(linksSection)
    .addSection(navSection)
    .build();
}

function saveSettings(e) {
  var props = PropertiesService.getUserProperties();
  var form = e.formInput || {};
  var existingToken = props.getProperty("SAAS_TOKEN") || "";
  var incomingToken = form.SAAS_TOKEN !== undefined ? String(form.SAAS_TOKEN || "").trim() : "";
  var tokenChanged = incomingToken && incomingToken !== existingToken;
  var docId = getActiveDocIdSafe_();

  if (form.API_BASE_URL !== undefined) {
    props.setProperty("API_BASE_URL", form.API_BASE_URL);
  }
  if (incomingToken) {
    props.setProperty("SAAS_TOKEN", incomingToken);
  }
  if (form.PROJECT_ID !== undefined) {
    props.setProperty("PROJECT_ID", form.PROJECT_ID);
    setDocScopedProperty_(props, docId, "PROJECT_ID", form.PROJECT_ID);
  }
  if (form.PROJECT_VERSION_ID !== undefined) {
    props.setProperty("PROJECT_VERSION_ID", form.PROJECT_VERSION_ID);
    setDocScopedProperty_(props, docId, "PROJECT_VERSION_ID", form.PROJECT_VERSION_ID);
  }
  if (form.TOPIC_ID !== undefined) {
    props.setProperty("TOPIC_ID", form.TOPIC_ID);
    setDocScopedProperty_(props, docId, "TOPIC_ID", form.TOPIC_ID);
  }
  if (form.DOC_SLUG !== undefined) {
    props.setProperty("DOC_SLUG", form.DOC_SLUG);
    setDocScopedProperty_(props, docId, "DOC_SLUG", form.DOC_SLUG);
  }

  if (tokenChanged) {
    props.deleteProperty("BOOTSTRAP_JSON");
    props.deleteProperty("BOOTSTRAP_AT");
    props.deleteProperty("PROJECT_ID");
    props.deleteProperty("PROJECT_VERSION_ID");
    props.deleteProperty("TOPIC_ID");
    if (docId) {
      clearDocScopedSelection_(props, docId);
    }
  }

  var target = (e && e.parameters && e.parameters.target) ? e.parameters.target : "home";
  return buildActionResponse_({ type: "success", text: "Settings saved." }, false, target);
}

function refreshBootstrap(e) {
  var props = PropertiesService.getUserProperties();
  var apiBase = props.getProperty("API_BASE_URL") || DEFAULT_API_BASE;
  var token = props.getProperty("SAAS_TOKEN") || "";
  var docId = getActiveDocIdSafe_();

  if (!token) {
    return buildActionResponse_({ type: "info", text: "Paste your Docspeare token first." }, false, "settings");
  }

  loadBootstrap_(apiBase, token, true, docId);
  var target = (e && e.parameters && e.parameters.target) ? e.parameters.target : "home";
  return buildActionResponse_({ type: "success", text: "Projects refreshed." }, false, target);
}

function publishDoc(e) {
  try {
    return submitDoc_("publish", e);
  } catch (err) {
    return buildErrorCard_("Publish failed: " + err.message);
  }
}

function previewDoc(e) {
  try {
    return submitDoc_("preview", e);
  } catch (err) {
    return buildErrorCard_("Preview failed: " + err.message);
  }
}

function unpublishDoc(e) {
  try {
    return submitDoc_("unpublish", e);
  } catch (err) {
    return buildErrorCard_("Unpublish failed: " + err.message);
  }
}

function submitDoc_(mode, e) {
  var props = PropertiesService.getUserProperties();
  var form = (e && e.formInput) ? e.formInput : null;
  if (form) {
    applyFormInputToProps_(props, form);
  }
  var docId = getActiveDocIdSafe_();
  var apiBase = props.getProperty("API_BASE_URL") || DEFAULT_API_BASE;
  var token = props.getProperty("SAAS_TOKEN") || "";
  var projectId = getDocScopedProperty_(props, docId, "PROJECT_ID") || props.getProperty("PROJECT_ID") || "";
  var projectVersionId = getDocScopedProperty_(props, docId, "PROJECT_VERSION_ID") || props.getProperty("PROJECT_VERSION_ID") || "";
  var topicId = getDocScopedProperty_(props, docId, "TOPIC_ID") || props.getProperty("TOPIC_ID") || "";
  var docSlug = getDocScopedProperty_(props, docId, "DOC_SLUG") || props.getProperty("DOC_SLUG") || "";

  if (!token || !projectId) {
    return buildHomeCard_({ type: "error", text: "Missing token or project. Save settings first." });
  }

  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();
  var contentText = body.getText();
  var contentHtml = buildSimpleHtml_(body);

  var payload = {
    projectId: projectId,
    projectVersionId: projectVersionId || null,
    topicId: topicId || null,
    slug: docSlug || null,
    sourceDocId: doc.getId(),
    title: doc.getName(),
    contentText: contentText,
    contentHtml: contentHtml
  };

  var url = apiBase.replace(/\/$/, "") + (mode === "publish" ? "/api/publish" : "/api/preview");
  if (mode === "unpublish") {
    url = apiBase.replace(/\/$/, "") + "/api/unpublish";
  }
  var response;
  try {
    response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (err) {
    return buildActionResponse_({ type: "error", text: "Request failed: " + err.message }, true);
  }

  var statusCode = response.getResponseCode();
  var bodyText = response.getContentText();

  if (statusCode >= 200 && statusCode < 300) {
    props.deleteProperty("LAST_ERROR_DETAILS");
    storeLastResultUrl_(props, mode, bodyText);
    storeLastAction_(props, mode);
    var openUrl = getOpenUrlFromResponse_(props, mode, bodyText);
    return buildActionResponse_(formatApiMessage_(mode, statusCode, bodyText, true), false, "home", openUrl);
  }

  props.setProperty("LAST_ERROR_DETAILS", "HTTP " + statusCode + ". " + bodyText);
  storeLastAction_(props, mode);
  return buildActionResponse_(formatApiMessage_(mode, statusCode, bodyText, false), true, "home");
}

function getActiveDocIdSafe_() {
  try {
    var doc = DocumentApp.getActiveDocument();
    return doc ? doc.getId() : "";
  } catch (err) {
    return "";
  }
}

function docScopedKey_(docId, key) {
  if (!docId) return "";
  return "DOC_" + docId + "_" + key;
}

function getDocScopedProperty_(props, docId, key) {
  var scopedKey = docScopedKey_(docId, key);
  if (!scopedKey) return "";
  return props.getProperty(scopedKey) || "";
}

function setDocScopedProperty_(props, docId, key, value) {
  var scopedKey = docScopedKey_(docId, key);
  if (!scopedKey) return;
  props.setProperty(scopedKey, value || "");
}

function clearDocScopedSelection_(props, docId) {
  var keys = ["PROJECT_ID", "PROJECT_VERSION_ID", "TOPIC_ID", "DOC_SLUG"];
  for (var i = 0; i < keys.length; i++) {
    var scopedKey = docScopedKey_(docId, keys[i]);
    if (scopedKey) {
      props.deleteProperty(scopedKey);
    }
  }
}

function applyFormInputToProps_(props, form) {
  var currentProjectId = props.getProperty("PROJECT_ID") || "";
  var incomingProjectId = form.PROJECT_ID !== undefined ? form.PROJECT_ID : currentProjectId;
  var projectChanged = form.PROJECT_ID !== undefined && incomingProjectId !== currentProjectId;
  var docId = getActiveDocIdSafe_();

  if (form.PROJECT_ID !== undefined) {
    props.setProperty("PROJECT_ID", incomingProjectId);
    setDocScopedProperty_(props, docId, "PROJECT_ID", incomingProjectId);
  }
  if (form.PROJECT_VERSION_ID !== undefined) {
    var versionValue = projectChanged ? "" : form.PROJECT_VERSION_ID;
    props.setProperty("PROJECT_VERSION_ID", versionValue);
    setDocScopedProperty_(props, docId, "PROJECT_VERSION_ID", versionValue);
  }
  if (form.TOPIC_ID !== undefined) {
    var topicValue = projectChanged ? "" : form.TOPIC_ID;
    props.setProperty("TOPIC_ID", topicValue);
    setDocScopedProperty_(props, docId, "TOPIC_ID", topicValue);
  }
  if (form.DOC_SLUG !== undefined) {
    props.setProperty("DOC_SLUG", form.DOC_SLUG);
    setDocScopedProperty_(props, docId, "DOC_SLUG", form.DOC_SLUG);
  }
}

function storeLastResultUrl_(props, mode, bodyText) {
  var url = "";
  try {
    var json = JSON.parse(bodyText);
    url = json.previewUrl || json.publishedUrl || json.url || "";
  } catch (err) {
    url = "";
  }

  if (!url) {
    return;
  }

  props.setProperty("LAST_RESULT_URL", url);
  var label = "Open Result";
  if (mode === "preview") label = "Open Preview";
  if (mode === "publish") label = "Open Published";
  props.setProperty("LAST_RESULT_LABEL", label);
}

function getOpenUrlFromResponse_(props, mode, bodyText) {
  if (mode !== "preview") return "";
  var apiBase = props.getProperty("API_BASE_URL") || DEFAULT_API_BASE;
  var webBase = getWebBase_(apiBase);
  try {
    var json = JSON.parse(bodyText);
    if (json.previewUrl) return json.previewUrl;
    if (json.documentId) return webBase + "/page/" + json.documentId;
  } catch (err) {
    return "";
  }
  return "";
}

function storeLastAction_(props, mode) {
  var label = "Updated";
  if (mode === "publish") label = "Published";
  if (mode === "preview") label = "Previewed";
  if (mode === "unpublish") label = "Unpublished";
  props.setProperty("LAST_ACTION_LABEL", label);
  props.setProperty("LAST_ACTION_AT", new Date().toLocaleString());
}

function buildAuthCard_() {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(BRAND_NAME))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText("<b>Authorize access</b><br/>We need permission to call Docspeare APIs."))
        .addWidget(
          CardService.newButtonSet()
            .addButton(
              CardService.newTextButton()
                .setText("Authorize")
                .setOnClickAction(CardService.newAction().setFunctionName("requestAuthorization"))
                .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
            )
        )
    )
    .build();
}

function requestAuthorization() {
  try {
    UrlFetchApp.fetch("https://www.docspeare.com/api/ping", { muteHttpExceptions: true });
  } catch (err) {
    return buildErrorCard_("Authorization failed: " + err.message);
  }
  return buildActionResponse_({ type: "success", text: "Authorization complete. Please reopen the add-on." }, false);
}

function buildErrorCard_(message) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(BRAND_NAME))
    .addSection(
      CardService.newCardSection()
        .addWidget(buildStatusWidget_("error", message || "Something went wrong."))
    )
    .build();
}

function buildActionResponse_(message, showInlineError, target, openUrl) {
  var builder = CardService.newActionResponseBuilder();

  if (message && message.text) {
    builder.setNotification(
      CardService.newNotification().setText(message.text)
    );
  }

  var cardMessage = null;
  if (showInlineError && message && message.type === "error") {
    cardMessage = message;
  }

  var destinationCard = buildHomeCard_(cardMessage);
  if (target === "settings") {
    destinationCard = buildSettingsCard_(cardMessage);
  }

  builder.setNavigation(
    CardService.newNavigation().updateCard(destinationCard)
  );

  if (openUrl) {
    builder.setOpenLink(CardService.newOpenLink().setUrl(openUrl));
  }

  return builder.build();
}

function loadBootstrap_(apiBase, token, forceRefresh, docId) {
  var props = PropertiesService.getUserProperties();
  if (!forceRefresh) {
    var cached = props.getProperty("BOOTSTRAP_JSON");
    var cachedAt = Number(props.getProperty("BOOTSTRAP_AT") || "0");
    var cachedToken = props.getProperty("BOOTSTRAP_TOKEN") || "";
    if (cached && cachedAt && Date.now() - cachedAt < 5 * 60 * 1000) {
      if (cachedToken && cachedToken !== token) {
        // Token changed, ignore cache.
      } else {
      return { data: JSON.parse(cached), error: null };
      }
    }
  }

  var url = apiBase.replace(/\/$/, "") + "/api/addon/bootstrap";
  try {
    var response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token
      },
      payload: JSON.stringify({ googleDocId: docId || null }),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
      var data = JSON.parse(response.getContentText());
      props.setProperty("BOOTSTRAP_JSON", JSON.stringify(data));
      props.setProperty("BOOTSTRAP_AT", String(Date.now()));
      props.setProperty("BOOTSTRAP_TOKEN", token || "");
      return { data: data, error: null };
    }

    return { data: null, error: formatApiErrorText_(response.getResponseCode(), response.getContentText()) };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

function buildProjectOptions_(projects) {
  if (!projects || projects.length === 0) return [];

  var byParent = {};
  for (var i = 0; i < projects.length; i++) {
    var project = projects[i];
    var parentId = project.parent_id || "";
    if (!byParent[parentId]) byParent[parentId] = [];
    byParent[parentId].push(project);
  }

  var roots = byParent[""] || byParent[null] || [];
  var options = [];

  function walk(list, depth) {
    if (!list) return;
    list.sort(function(a, b) {
      return (a.name || "").localeCompare(b.name || "");
    });
    for (var j = 0; j < list.length; j++) {
      var item = list[j];
      var prefix = depth > 0 ? new Array(depth + 1).join("-- ") : "";
      options.push({
        label: prefix + item.name,
        value: item.id
      });
      walk(byParent[item.id], depth + 1);
    }
  }

  walk(roots, 0);
  return options;
}

function buildVersionOptions_(versions, projectId) {
  if (!projectId || !versions) return [];
  var options = [];
  for (var i = 0; i < versions.length; i++) {
    var version = versions[i];
    if (version.project_id !== projectId) continue;
    var label = version.name || version.slug || version.id;
    if (version.is_default) label += " (default)";
    options.push({
      label: label,
      value: version.id,
      is_default: version.is_default
    });
  }
  return options;
}

function pickDefaultVersionId_(options) {
  if (!options || options.length === 0) return "";
  for (var i = 0; i < options.length; i++) {
    if (options[i].is_default) return options[i].value;
  }
  return options[0].value;
}

function buildTopicOptions_(topics, projectId) {
  if (!projectId || !topics) return [];
  var filtered = [];
  for (var i = 0; i < topics.length; i++) {
    if (topics[i].project_id === projectId) filtered.push(topics[i]);
  }

  if (filtered.length === 0) return [];

  var byParent = {};
  for (var j = 0; j < filtered.length; j++) {
    var topic = filtered[j];
    var parentId = topic.parent_id || "";
    if (!byParent[parentId]) byParent[parentId] = [];
    byParent[parentId].push(topic);
  }

  var roots = byParent[""] || byParent[null] || [];

  function sortTopics(list) {
    return list.sort(function(a, b) {
      var orderA = a.display_order || 0;
      var orderB = b.display_order || 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.name || "").localeCompare(b.name || "");
    });
  }

  var options = [];
  function walk(list, depth) {
    if (!list) return;
    sortTopics(list);
    for (var k = 0; k < list.length; k++) {
      var item = list[k];
      var prefix = depth > 0 ? new Array(depth + 1).join("-- ") : "";
      options.push({
        label: prefix + item.name,
        value: item.id
      });
      walk(byParent[item.id], depth + 1);
    }
  }

  walk(roots, 0);
  return options;
}

function buildSimpleHtml_(body) {
  var paragraphs = body.getParagraphs();
  var html = [];
  for (var i = 0; i < paragraphs.length; i++) {
    var text = paragraphs[i].getText();
    if (text) {
      html.push("<p>" + escapeHtml_(text) + "</p>");
    }
  }
  return html.join("\n");
}

function escapeHtml_(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildStatusWidget_(type, text) {
  var label = "Info";
  if (type === "success") label = "Success";
  if (type === "error") label = "Error";
  return CardService.newTextParagraph().setText("<b>" + label + ":</b> " + escapeHtml_(text || ""));
}

function buildStatusWidgetFromMessage_(message) {
  if (typeof message === "string") {
    return buildStatusWidget_("info", message);
  }
  if (!message) {
    return buildStatusWidget_("info", "");
  }
  return buildStatusWidget_(message.type || "info", message.text || "");
}

function formatApiMessage_(mode, statusCode, bodyText, isSuccess) {
  var json = null;
  try {
    json = JSON.parse(bodyText);
  } catch (err) {
    json = null;
  }

  if (isSuccess) {
    return {
      type: "success",
      text: formatApiSuccessText_(mode, json, bodyText)
    };
  }

  return {
    type: "error",
    text: formatApiErrorText_(statusCode, json || bodyText)
  };
}

function formatApiSuccessText_(mode, json, bodyText) {
  if (json) {
    if (json.previewUrl) return "Preview ready: " + json.previewUrl;
    if (json.previewId) return "Preview created (ID: " + json.previewId + ")";
    if (json.publishedUrl) return "Published: " + json.publishedUrl;
    if (json.url) {
      return (mode === "publish" ? "Published: " : "Preview ready: ") + json.url;
    }
    if (json.status) return "Status: " + json.status;
  }
  return bodyText || "Request succeeded.";
}

function formatApiErrorText_(statusCode, payload) {
  var friendly = {
    400: "Missing required data. Check your project and try again.",
    401: "Authentication failed. Re-open Settings and paste a new token.",
    402: "Billing is inactive for this workspace.",
    403: "You do not have access to this project.",
    404: "Project not found. Refresh projects and try again.",
    409: "This document already exists elsewhere. Use a different project or version.",
    422: "Invalid request. Check your selections and try again.",
    500: "Server error. Please try again or contact support.",
  };
  if (payload && typeof payload === "object") {
    if (payload.error) return payload.error;
    if (payload.message) return payload.message;
  }
  var text = payload && typeof payload === "string" ? payload : "Request failed.";
  if (text && typeof text === "string") {
    try {
      var parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object") {
        if (parsed.error) text = parsed.error;
        else if (parsed.message) text = parsed.message;
      }
    } catch (err) {
      // leave as-is if not JSON
    }
  }
  if (statusCode) {
    if (friendly[statusCode]) return friendly[statusCode];
    return "HTTP " + statusCode + ". " + text;
  }
  return text;
}
