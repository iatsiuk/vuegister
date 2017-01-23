<template>
  <h2 class="red">{{msg}}</h2>
</template>

<script>
module.exports = {
  data () {
    throw new Error('Error msg')
  }
}
</script>
