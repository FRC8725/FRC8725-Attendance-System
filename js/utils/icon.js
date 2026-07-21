export function icon(name, extraClass = '') {
  return `<span class="ico-svg ${extraClass}" style="--icon-url:url('images/icons/${name}.svg'); mask-image: var(--icon-url); -webkit-mask-image: var(--icon-url);"></span>`;
}
