<!-- basic.vue -->

<template>
  <h2 class="red">{{msg}}</h2>
  <template v-if="true">
    <h3>Header3</h3>
  </template>
</template>

<script>
  module.exports = {
    // test data
    data () {
      return {
        msg: 'Hello'
      }
    }
  }
</script>

<style>
  comp-a h2 {
    color: #f00;
  }
</style>
