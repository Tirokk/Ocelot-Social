<template>
  <div id="footer" class="ds-footer">
    <a :href="links.ORGANIZATION" target="_blank" v-html="$t('site.made')"></a>
    <span>-</span>
    <nuxt-link to="/imprint">
      {{ $t('site.imprint') }}
    </nuxt-link>
    <span>-</span>
    <nuxt-link to="/terms-and-conditions">{{ $t('site.termsAndConditions') }}</nuxt-link>
    <span>-</span>
    <nuxt-link to="/code-of-conduct">{{ $t('site.code-of-conduct') }}</nuxt-link>
    <span>-</span>
    <nuxt-link to="/data-privacy">
      {{ $t('site.data-privacy') }}
    </nuxt-link>
    <span>-</span>
    <a :href="links.FAQ" target="_blank">
      {{ $t('site.faq') }}
    </a>
    <span>-</span>
    <a
      href="https://github.com/Ocelot-Social-Community/Ocelot-Social/blob/master/CHANGELOG.md"
      target="_blank"
    >
      {{ version }}
    </a>
  </div>
</template>

<script>
import links from '~/constants/links.js'
export default {
  data() {
    return { links, version: `v${process.env.release}` }
  },
}
</script>

<style lang="scss" scoped>
.ds-footer {
  text-align: center;
  position: fixed;
  bottom: 0px;
  z-index: 10;
  background-color: white;
  width: 100%;
  padding: 10px 10px;
  box-shadow: 0px -6px 12px -4px rgba(0, 0, 0, 0.1);
}
span {
  margin-right: 0.2rem;
}
</style>
