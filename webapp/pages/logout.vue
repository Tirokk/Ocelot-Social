<template>
  <ds-container width="small">
    <ds-flex>
      <ds-flex-item :width="{ base: '100%' }" centered>
        <ds-space style="text-align: center" margin-top="large" margin-bottom="xxx-small" centered>
          <img style="width: 200px" alt="Logging out" src="/img/custom/logout.svg" />
        </ds-space>
        <ds-space style="text-align: center" margin-top="small" margin-bottom="xxx-small" centered>
          <ds-heading tag="h3" soft>Logging out...</ds-heading>
        </ds-space>
      </ds-flex-item>
    </ds-flex>
  </ds-container>
</template>

<script>
export default {
  layout: 'blank',
  async beforeCreate() {
    await this.$store.dispatch('auth/logout')
    this.$router.replace('/login')
  },
}
</script>
