var DEFAULT_API_BASE = "https://www.docspeare.com";

function onHomepage() {
  return buildHomeCard_(null);
}

function buildHomeCard_(message) {
  var props = PropertiesService.getUserProperties();
  var apiBase = props.getProperty("API_BASE_URL") || DEFAULT_API_BASE;
  var token = props.getProperty("SAAS_TOKEN") || "";
  var projectId = props.getProperty("PROJECT_ID") || "";
  var projectVersionId = props.getProperty("PROJECT_VERSION_ID") || "";
  var topicId = props.getProperty("TOPIC_ID") || "";

  var section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText("Connect your Docspeare workspace and publish from Google Docs."))
    .addWidget(buildTextInput_("API_BASE_URL", "SaaS Base URL", apiBase, "https://www.docspeare.com"))
    .addWidget(buildTextInput_("SAAS_TOKEN", "SaaS Token", token, "Paste the add-on token"))
    .addWidget(buildTextInput_("PROJECT_ID", "Project ID", projectId, "Paste target project id"))
    .addWidget(buildTextInput_("PROJECT_VERSION_ID", "Project Version ID (optional)", projectVersionId, "Use default if blank"))
    .addWidget(buildTextInput_("TOPIC_ID", "Topic ID (optional)", topicId, "Attach to a topic"))
    .addWidget(
      CardService.newButtonSet()
        .addButton(
          CardService.newTextButton()
            .setText("Save Settings")
            .setOnClickAction(CardService.newAction().setFunctionName("saveSettings"))
            .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        )
    );

  var actionSection = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText("Publish or preview the current document."))
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
    );

  if (message) {
    actionSection.addWidget(CardService.newTextParagraph().setText(message));
  }

  return CardService.newCardBuilder()
    .addSection(section)
    .addSection(actionSection)
    .build();
}

function buildTextInput_(fieldName, title, value, hint) {
  return CardService.newTextInput()
    .setFieldName(fieldName)
    .setTitle(title)
    .setValue(value || "")
    .setHint(hint || "");
}

function saveSettings(e) {
  var props = PropertiesService.getUserProperties();
  var form = e.formInput || {};
  if (form.API_BASE_URL !== undefined) {
    props.setProperty("API_BASE_URL", form.API_BASE_URL);
  }
  if (form.SAAS_TOKEN !== undefined) {
    props.setProperty("SAAS_TOKEN", form.SAAS_TOKEN);
  }
  if (form.PROJECT_ID !== undefined) {
    props.setProperty("PROJECT_ID", form.PROJECT_ID);
  }
  if (form.PROJECT_VERSION_ID !== undefined) {
    props.setProperty("PROJECT_VERSION_ID", form.PROJECT_VERSION_ID);
  }
  if (form.TOPIC_ID !== undefined) {
    props.setProperty("TOPIC_ID", form.TOPIC_ID);
  }

  return buildHomeCard_("Settings saved.");
}

function publishDoc() {
  return submitDoc_("publish");
}

function previewDoc() {
  return submitDoc_("preview");
}

function submitDoc_(mode) {
  var props = PropertiesService.getUserProperties();
  var apiBase = props.getProperty("API_BASE_URL") || DEFAULT_API_BASE;
  var token = props.getProperty("SAAS_TOKEN") || "";
  var projectId = props.getProperty("PROJECT_ID") || "";
  var projectVersionId = props.getProperty("PROJECT_VERSION_ID") || "";
  var topicId = props.getProperty("TOPIC_ID") || "";

  if (!token || !projectId) {
    return buildHomeCard_("Missing token or project id. Save settings first.");
  }

  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();
  var contentText = body.getText();
  var contentHtml = buildSimpleHtml_(body);

  var payload = {
    projectId: projectId,
    projectVersionId: projectVersionId || null,
    topicId: topicId || null,
    sourceDocId: doc.getId(),
    title: doc.getName(),
    contentText: contentText,
    contentHtml: contentHtml
  };

  var url = apiBase.replace(/\/$/, "") + (mode === "publish" ? "/api/publish" : "/api/preview");
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
    return buildHomeCard_("Request failed: " + err.message);
  }

  var statusCode = response.getResponseCode();
  var bodyText = response.getContentText();

  if (statusCode >= 200 && statusCode < 300) {
    return buildHomeCard_("Success: " + bodyText);
  }

  return buildHomeCard_("Error (" + statusCode + "): " + bodyText);
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
