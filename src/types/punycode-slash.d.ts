// `import "punycode/"` (with trailing slash) forces Node to resolve the userland
// `punycode` package instead of Node's deprecated built-in. The npm package itself
// only ships types for the bare `"punycode"` specifier, so we redeclare them here.
declare module "punycode/" {
  import punycode from "punycode";
  export default punycode;
}
