var DEFAULT_API_BASE = "https://www.docspeare.com";

function onHomepage(e) {
  return buildHomeCard_(null);
}

function buildHomeCard_(message) {
  var props = PropertiesService.getUserProperties();
  var apiBase = props.getProperty("API_BASE_URL") || DEFAULT_API_BASE;
  var token = props.getProperty("SAAS_TOKEN") || "";
  var projectId = props.getProperty("PROJECT_ID") || "";
  var projectVersionId = props.getProperty("PROJECT_VERSION_ID") || "";
  var topicId = props.getProperty("TOPIC_ID") || "";

  var bootstrap = null;
  var bootstrapError = null;
  if (token) {
    var bootstrapResult = loadBootstrap_(apiBase, token);
    bootstrap = bootstrapResult.data;
    bootstrapError = bootstrapResult.error;
  }

  var projects = (bootstrap && bootstrap.projects) ? bootstrap.projects : [];
  var projectOptions = buildProjectOptions_(projects);
  var autoProjectId = projectId;
  if (!autoProjectId && projectOptions.length === 1) {
    autoProjectId = projectOptions[0].value;
    props.setProperty("PROJECT_ID", autoProjectId);
  }

  var projectVersions = (bootstrap && bootstrap.projectVersions) ? bootstrap.projectVersions : [];
  var versionOptions = buildVersionOptions_(projectVersions, autoProjectId);
  var autoVersionId = projectVersionId || pickDefaultVersionId_(versionOptions);
  if (!projectVersionId && autoVersionId) {
    props.setProperty("PROJECT_VERSION_ID", autoVersionId);
  }

  var topics = (bootstrap && bootstrap.topics) ? bootstrap.topics : [];
  var topicOptions = buildTopicOptions_(topics, autoProjectId);

  var section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText("Connect your Docspeare workspace and publish from Google Docs."))
    .addWidget(buildTextInput_("API_BASE_URL", "SaaS Base URL", apiBase, "https://www.docspeare.com"))
    .addWidget(buildTextInput_("SAAS_TOKEN", "SaaS Token", token, "Paste the add-on token"))
    .addWidget(
      CardService.newButtonSet()
        .addButton(
          CardService.newTextButton()
            .setText("Refresh Projects")
            .setOnClickAction(CardService.newAction().setFunctionName("refreshBootstrap"))
        )
    );

  if (!token) {
    section.addWidget(CardService.newTextParagraph().setText("Paste your SaaS token to load projects and topics."));
  } else if (bootstrapError) {
    section.addWidget(CardService.newTextParagraph().setText("Could not load projects: " + bootstrapError));
  } else if (projectOptions.length === 0) {
    section.addWidget(CardService.newTextParagraph().setText("No projects found for this workspace."));
  } else {
    section
      .addWidget(buildSelectInput_("PROJECT_ID", "Project", projectOptions, autoProjectId, false))
      .addWidget(buildSelectInput_("PROJECT_VERSION_ID", "Project Version", versionOptions, autoVersionId, true, "Use default version"))
      .addWidget(buildSelectInput_("TOPIC_ID", "Topic (optional)", topicOptions, topicId, true, "No topic"));
  }

  section.addWidget(
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

function buildSelectInput_(fieldName, title, options, selectedValue, allowEmpty, emptyLabel) {
  var input = CardService.newSelectionInput()
    .setFieldName(fieldName)
    .setTitle(title)
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

function refreshBootstrap(e) {
  var props = PropertiesService.getUserProperties();
  var apiBase = props.getProperty("API_BASE_URL") || DEFAULT_API_BASE;
  var token = props.getProperty("SAAS_TOKEN") || "";

  if (!token) {
    return buildHomeCard_("Paste your SaaS token first.");
  }

  loadBootstrap_(apiBase, token, true);
  return buildHomeCard_("Projects refreshed.");
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

function loadBootstrap_(apiBase, token, forceRefresh) {
  var props = PropertiesService.getUserProperties();
  if (!forceRefresh) {
    var cached = props.getProperty("BOOTSTRAP_JSON");
    var cachedAt = Number(props.getProperty("BOOTSTRAP_AT") || "0");
    if (cached && cachedAt && Date.now() - cachedAt < 5 * 60 * 1000) {
      return { data: JSON.parse(cached), error: null };
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
      payload: JSON.stringify({}),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
      var data = JSON.parse(response.getContentText());
      props.setProperty("BOOTSTRAP_JSON", JSON.stringify(data));
      props.setProperty("BOOTSTRAP_AT", String(Date.now()));
      return { data: data, error: null };
    }

    return { data: null, error: response.getContentText() };
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
