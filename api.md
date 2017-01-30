<a name="module_vuegister"></a>

## vuegister

* [vuegister](#module_vuegister)
    * [extract(content)](#exp_module_vuegister--extract) ⇒ <code>object</code> ⏏
    * [load(file)](#exp_module_vuegister--load) ⇒ <code>object</code> ⏏
    * [register([options])](#exp_module_vuegister--register) ⇒ <code>boolean</code> ⏏
    * [unregister()](#exp_module_vuegister--unregister) ⇒ <code>array</code> ⏏
    * [_processLangAttr(lang, code, options)](#exp_module_vuegister--_processLangAttr) ⇒ <code>object</code> ⏏
    * [_generateMap(content, file, offset)](#exp_module_vuegister--_generateMap) ⇒ <code>object</code> ⏏

<a name="exp_module_vuegister--extract"></a>

### extract(content) ⇒ <code>object</code> ⏏
Extracts text and all attributes from the script tag, low level API

**Parameters**

- content <code>string</code> - Content of the SFC file.

**Returns**: <code>object</code> - Returns an object of the following format:
```js
{
  content: string, // raw text from the script tag
  attribs: object, // key-value pairs, attributes from the src script tag
  start: number,   // line number where the script begins in the SFC
  end: number,     // line number where the script ends in the SFC
}
```  
**Kind**: Exported function  
<a name="exp_module_vuegister--load"></a>

### load(file) ⇒ <code>object</code> ⏏
Parses SFC, high level API

**Parameters**

- file <code>string</code> - Absolute path to the SFC.

**Returns**: <code>object</code> - Returns the following object:
```js
{
  file: string,      // full path to the SFC or absolute path to the external
                     // script from src attribute of script tag
  code: string,      // text from the script tag or external script
  lang: string,      // value from the lang script attribute
  mapOffset: number, // line number where the script begins in the SCF minus
                     // one or zero for external script
}
```  
**Kind**: Exported function  
<a name="exp_module_vuegister--register"></a>

### register([options]) ⇒ <code>boolean</code> ⏏
Setups hook on require *.vue extension.

**Parameters**

- [options] <code>object</code> - Available options are:
```js
{
  maps: boolean,   // generate source map
  plugins: object, // user configuration for the plugins, for example:
                   // {
                   //   babel: {
                   //     babelrc: true,
                   //   },
                   // }
}
```

**Returns**: <code>boolean</code> - Returns true on success.  
**Kind**: Exported function  
<a name="exp_module_vuegister--unregister"></a>

### unregister() ⇒ <code>array</code> ⏏
Removes requre hook.

**Returns**: <code>array</code> - Returns list of unloaded modules.  
**Kind**: Exported function  
<a name="exp_module_vuegister--_processLangAttr"></a>

### _processLangAttr(lang, code, options) ⇒ <code>object</code> ⏏
Passes given code to the external plugin.

**Parameters**

- lang <code>string</code> - Lang attribute from the scrip tag.
- code <code>string</code> - Code for the transpiler.
- options <code>object</code> - Options, an object of the following format:
```js
{
  file: string,      // 'unknown', file name
  maps: boolean,     // false, provide source map
  mapOffset: number, // 0, map offset
  extra: object,     // {}, plugin options from the user
}
```

**Returns**: <code>object</code> - Returns the following object:
```js
{
  code: string, // transpiled code, JavaScript
  map: object,  // generated source map
}
```  
**Kind**: Exported function  
<a name="exp_module_vuegister--_generateMap"></a>

### _generateMap(content, file, offset) ⇒ <code>object</code> ⏏
Generates source map for JavaScript.

**Parameters**

- content <code>string</code> - Content of the script tag.
- file <code>string</code> - File name of the generated source.
- offset <code>number</code> - Offset for script tag, usually "script.start - 1"

**Returns**: <code>object</code> - Returns the source map.  
**Kind**: Exported function  
