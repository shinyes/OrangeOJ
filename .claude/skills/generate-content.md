---
name: generate-content
description: Generate OrangeOJ problems, training plans, and practices in the correct import format — ZIP with problems.json, images/, and optional trainingPlan.json/practice.json.
metadata:
  type: reference
---

# OrangeOJ Content Generation Guide

This skill teaches you how to generate content for OrangeOJ (an online judge / learning management system) that can be imported via the admin UI or API.

---

## Quick Start

To generate content, you produce a **ZIP file** containing:

| File | Required | Description |
|------|----------|-------------|
| `problems.json` | ✅ Always | Array of problem objects |
| `images/` directory | Only if problems reference images | Image files (PNG, JPG, GIF, WEBP, SVG) |
| `trainingPlan.json` | For training plan import | Chapter structure and metadata |
| `practice.json` | Exported by system only | Practice metadata (not importable) |

**API routes for import (space admin required):**
- `POST /api/spaces/{spaceId}/problems/import` — import problems (ZIP)
- `POST /api/spaces/{spaceId}/training-plans/import` — import training plan (ZIP with problems + chapters)

**Max ZIP size:** 100 MB
**Max single image size:** 10 MB

---

## Problem Types

Three problem types are supported:

| `type` value | Display | Description |
|---|---|---|
| `"programming"` | 编程题 | Code writing, requires `timeLimitMs` + `memoryLimitMiB` |
| `"single_choice"` | 单选题 | Multiple choice, single correct answer |
| `"true_false"` | 判断题 | True / false question |

---

## problems.json Format

`problems.json` is a top-level JSON array of problem objects. Each problem object has the following fields:

```json
{
  "type": "programming",
  "title": "题目标题",
  "tags": ["标签1", "标签2"],
  "statementMd": "## Markdown 题目描述\n\n支持 ![图片](/api/uploads/image.png)",
  "bodyJson": { },
  "answerJson": { },
  "timeLimitMs": 1000,
  "memoryLimitMiB": 256
}
```

### Common fields (all types)

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | ✅ | `"programming"`, `"single_choice"`, or `"true_false"` |
| `title` | string | ✅ | Problem title |
| `tags` | string[] | | Tags for filtering/categorization |
| `statementMd` | string | | Problem statement in Markdown. **Image refs in ZIP files use `![](images/filename.png)` format — they get auto-rewritten to `/api/uploads/filename.png` on import** |
| `bodyJson` | object | | Type-specific body config (options, etc.) |
| `answerJson` | object | | Type-specific answer config |
| `timeLimitMs` | int | Only `programming` | Time limit in milliseconds (default 1000) |
| `memoryLimitMiB` | int | Only `programming` | Memory limit in MiB (default 256) |

Fields default: `bodyJson` → `{}`, `answerJson` → `{}` if empty.

---

## Type-Specific Formats

### 1. programming (编程题)

```json
{
  "type": "programming",
  "title": "两数之和",
  "tags": ["数组", "哈希表"],
  "statementMd": "## 两数之和\n\n给定一个整数数组 `nums` 和一个整数目标值 `target`，请你在该数组中找出和为目标值的两个整数。\n\n![示意图](/api/uploads/example.png)\n\n### 输入格式\n第一行两个整数 n 和 target。第二行 n 个整数。\n\n### 输出格式\n输出两个整数，表示下标。",
  "bodyJson": {},
  "answerJson": {},
  "timeLimitMs": 1000,
  "memoryLimitMiB": 256
}
```

- `bodyJson` and `answerJson` are **unused** — leave as `{}`
- Must include `timeLimitMs` and `memoryLimitMiB`

### 2. single_choice (单选题)

```json
{
  "type": "single_choice",
  "title": "以下哪个是 Python 的关键字？",
  "tags": ["Python", "基础"],
  "statementMd": "以下哪个是 Python 的关键字？",
  "bodyJson": {
    "options": ["class", "function", "define", "var"]
  },
  "answerJson": {
    "answerIndex": 0
  }
}
```

- **`bodyJson.options`**: Required. Array of option strings. Order matters.
- **`answerJson.answerIndex`**: Index into `options` (0-based). The correct answer's index.

**Accepted alternative answer formats** (normalized on import):
```json
{ "answerIndex": 0 }                    // preferred: 0-based index
{ "answer": "class" }                   // matched by text to options
```

### 3. true_false (判断题)

```json
{
  "type": "true_false",
  "title": "Python 是一种编译型语言。",
  "tags": ["Python"],
  "statementMd": "Python 是一种编译型语言。",
  "bodyJson": {},
  "answerJson": {
    "answer": false
  }
}
```

- **`answerJson.answer`**: `true` or `false`.

**Accepted alternative answer values** (all get normalized):
| Input | Normalized |
|-------|------------|
| `true`, `"true"`, `"1"`, `"t"`, `"yes"` | `true` |
| `false`, `"false"`, `"0"`, `"f"`, `"no"` | `false` |

Alternative keys: `correct`, `correctAnswer`, `value` are also accepted in place of `answer`.

---

## Images

### In problems.json (inside ZIP)

Images in `statementMd` should use the **relative path** format for import:

```markdown
![alt text](images/filename.png)
```

The system auto-rewrites `(images/` → `(/api/uploads/` during import.

### In ZIP structure

```
my-content.zip
├── problems.json
├── images/
│   ├── example.png
│   ├── diagram.jpg
│   └── chart.svg
└── trainingPlan.json   (optional)
```

### Supported image extensions

`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`

### In database / after import

After import, all images are stored in `./uploads/` and served at `/api/uploads/filename.png`. References in Markdown are rewritten to:

```markdown
![alt text](/api/uploads/filename.png)
```

---

## Training Plan Import Format

When importing a training plan, the ZIP must contain:

| File | Required | Description |
|---|---|---|
| `problems.json` | ✅ | Problems array |
| `images/` | If problems reference images | Image files |
| `trainingPlan.json` | ✅ | Chapter structure |

### trainingPlan.json

```json
{
  "title": "Python 基础训练",
  "description": "适合初学者的 Python 基础训练",
  "tags": ["Python", "入门"],
  "chapters": [
    {
      "title": "变量与类型",
      "orderNo": 1,
      "problemIds": [0, 1, 2]
    },
    {
      "title": "控制流",
      "orderNo": 2,
      "problemIds": [3, 4]
    }
  ]
}
```

**Key rule**: `problemIds` are **0-based indices** into the `problems.json` array. The system maps them to actual database IDs after import.

So:
- `problemIds: [0, 1]` → the first and second problems in `problems.json`
- `problemIds: [3, 4]` → the fourth and fifth problems

### Complete training plan ZIP example structure

```
python-basics.zip
├── problems.json
├── images/
│   └── flowchart.png
└── trainingPlan.json
```

---

## Practice Export Format (read-only)

Practices are **NOT importable via ZIP** — they are created through the PracticeEditor UI. Exported practices contain:

```
practice-export.zip
├── problems.json      (problems in the practice)
├── practice.json      (practice metadata)
└── images/            (image files)
```

### practice.json

```json
{
  "title": "第一章测验",
  "description": "基础知识点测验",
  "tags": ["Python"]
}
```

---

## Examples

### Example 1: Single problem ZIP (for problem import)

<example>
```json title="problems.json"
[
  {
    "type": "single_choice",
    "title": "在 Python 中，用于定义函数的关键字是？",
    "tags": ["Python", "函数"],
    "statementMd": "在 Python 中，用于定义函数的关键字是？\n\nA. class\nB. function\nC. def\nD. define",
    "bodyJson": {
      "options": ["class", "function", "def", "define"]
    },
    "answerJson": {
      "answerIndex": 2
    }
  }
]
```
This file can be zipped alone (no images needed) and imported into any space.
</example>

### Example 2: Training plan with images

<example>
```json title="problems.json"
[
  {
    "type": "programming",
    "title": "循环打印",
    "tags": ["循环"],
    "statementMd": "## 循环打印\n\n参考下面的流程图，编写程序打印 1 到 10。\n\n![流程图](images/flowchart.png)",
    "bodyJson": {},
    "answerJson": {},
    "timeLimitMs": 1000,
    "memoryLimitMiB": 256
  }
]
```

```json title="trainingPlan.json"
{
  "title": "循环训练",
  "description": "",
  "tags": [],
  "chapters": [
    {
      "title": "基础循环",
      "orderNo": 1,
      "problemIds": [0]
    }
  ]
}
```

ZIP contents:
- `problems.json`
- `trainingPlan.json`
- `images/flowchart.png`
</example>

### Example 3: Mixed problem types

```json
[
  {
    "type": "single_choice",
    "title": "排序算法中平均时间复杂度为 O(n log n) 的是？",
    "tags": ["算法", "排序"],
    "statementMd": "以下排序算法中，平均时间复杂度为 O(n log n) 的是？",
    "bodyJson": {
      "options": ["冒泡排序", "选择排序", "归并排序", "插入排序"]
    },
    "answerJson": {
      "answerIndex": 2
    }
  },
  {
    "type": "true_false",
    "title": "二分查找要求数据必须是有序的。",
    "tags": ["算法", "查找"],
    "statementMd": "二分查找要求数据必须是有序的。",
    "bodyJson": {},
    "answerJson": {
      "answer": true
    }
  },
  {
    "type": "programming",
    "title": "斐波那契数列",
    "tags": ["递归"],
    "statementMd": "## 斐波那契数列\n\n编写程序输出斐波那契数列的第 n 项。",
    "bodyJson": {},
    "answerJson": {},
    "timeLimitMs": 1000,
    "memoryLimitMiB": 256
  }
]
```
</example>

---

## Generating Content via Agent

When asked to generate problems/training/practice content:

1. Ask for the **subject**, **difficulty level**, **number of problems**, and **target audience** if not specified
2. Generate `problems.json` in the correct format
3. If the statement references images (diagrams, flowcharts, screenshots), include descriptive alt text and place the image files in `images/`
4. For training plans, structure chapters logically and use correct 0-based problemIds
5. Output the file contents clearly so they can be assembled into a ZIP

**Images**: When you reference images in Markdown (`![](images/filename.png)`), describe what the image should contain so a human can create it, or generate it if you have image generation capability.

**ZIP creation**: Provide instructions to zip the files:
```
zip -r output.zip problems.json images/ trainingPlan.json
```
