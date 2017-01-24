<style>
  .red {
    color: #f00;
  }
</style>

<template>
  <h1 class="red">{{msg}}</h1>
</template>

<script lang="babel">
export default {
  data () {
    return {
      msg: 'Hello world!'
    }
  }
}
</script>
