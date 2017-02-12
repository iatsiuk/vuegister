## Modules

<dl>
<dt><a href="#module_vuegister">vuegister</a></dt>
<dd><p>The require hook for load SFC (single-file component or *.vue) files.</p>
</dd>
</dl>

## Classes

<dl>
<dt><a href="#Location">Location</a></dt>
<dd><p>Class for calculation of the line numbers.</p>
</dd>
</dl>

<a name="module_vuegister"></a>

## vuegister
The require hook for load SFC (single-file component or *.vue) files.


* [vuegister](#module_vuegister)
    * [extract(buf, tags)](#exp_module_vuegister--extract) ⇒ <code>array</code> ⏏
    * [load(buf, [file], [cfg])](#exp_module_vuegister--load) ⇒ <code>string</code> ⏏
    * [register([options])](#exp_module_vuegister--register) ⇒ <code>boolean</code> ⏏
    * [unregister()](#exp_module_vuegister--unregister) ⇒ <code>array</code> ⏏

<a name="exp_module_vuegister--extract"></a>

### extract(buf, tags) ⇒ <code>array</code> ⏏
Extracts SCF sections (inner text and all tag attributes) specified by
tags argument, low level API.

**Parameters**

- **buf**:  <code>string</code> - Content of the SFC file.
- **tags**:  <code>array</code> - List of sections to be extracted.

**Returns**: <code>array</code> - Returns extracted sections, each section is an object of
the following format:
```js
{
  tag: string,    // name of the tag
  text: string,   // inner text, content of the tag
  attrs: object,  // key-value pairs, attributes of the tag
  offset: number, // line number where the tag begins in the SCF minus
                  // one or zero for external file
}
```  
**Kind**: Exported function  
<a name="exp_module_vuegister--load"></a>

### load(buf, [file], [cfg]) ⇒ <code>string</code> ⏏
Parses SFC, high level API.

**Parameters**

- **buf**:  <code>string</code> - Content of the SFC file.
- **[file]**:  <code>string</code> - Full path to the SFC.
- **[cfg]**:  <code>object</code> - Options, an object of the following format:
```js
{
  maps: boolean,   // false, provide source map
  lang: object,    // {}, default language for tag without lang attribute,
                   // for example:
                   // {
                   //   {script: 'js'}
                   // }
  plugins: object, // {}, user configuration for the plugins, for example:
                   // {
                   //   babel: {
                   //     babelrc: true,
                   //   },
                   // }
}
```

**Returns**: <code>string</code> - Returns ready-to-use JavaScript with injected template.  
**Kind**: Exported function  
<a name="exp_module_vuegister--register"></a>

### register([options]) ⇒ <code>boolean</code> ⏏
Setups hook on require *.vue extension.

**Parameters**

- **[options]**:  <code>object</code> - Available options are:
```js
{
  maps: boolean,   // false, provide source map
  lang: object,    // {}, default language for tag without lang attribute,
                   // for example:
                   // {
                   //   {script: 'js'}
                   // }
  plugins: object, // {}, user configuration for the plugins, for example:
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
<a name="Location"></a>

## Location
Class for calculation of the line numbers.

**Kind**: global class  

* [Location](#Location)
    * [new Location(buf)](#new_Location_new)
    * [.getLine(index)](#Location+getLine) ⇒ <code>number</code>

<a name="new_Location_new"></a>

### new Location(buf)
Create class instance.

**Parameters**

- **buf**:  <code>string</code> - Raw text.

**Example**  
```js
let data = fs.readFileSync(file, 'utf8');
let loc = new Location(data);
```
<a name="Location+getLine"></a>

### location.getLine(index) ⇒ <code>number</code>
Get line number.

**Parameters**

- **index**:  <code>number</code> - the 0-based index.

**Returns**: <code>number</code> - Returns 0-based line number for given index.  
**Kind**: instance method of <code>[Location](#Location)</code>  
